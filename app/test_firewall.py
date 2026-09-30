import json
import tempfile
import unittest
from pathlib import Path
import firewall

NET={'interface':'wlan0','address':'192.168.10.5','network':'192.168.10.0/24','url':'http://192.168.10.5:8765/'}
class FirewallTests(unittest.TestCase):
    def fixture(self):
        rules=[];calls=[]
        def run(args):
            calls.append(args)
            if args[1:]==['status']:return 'Status: active\n'
            if args[1:]==['show','added']:
                import shlex
                return '\n'.join('ufw '+shlex.join(r) for r in rules)
            if args[1:3]==['allow','in']:rules.append(args[1:])
            elif args[1:3]==['--force','delete']:rules[:]=[r for r in rules if firewall.signature(r)!=firewall.signature(args[3:])]
            return ''
        return rules,calls,run
    def test_allow_deduplicates_and_remove_only_owned_rule(self):
        rules,calls,run=self.fixture()
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'state.json'
            args=dict(interface=NET['interface'],address=NET['address'],network=NET['network'],current=[NET],run=run,state=state)
            self.assertTrue(firewall.privileged('allow',**args)['changed'])
            self.assertFalse(firewall.privileged('allow',**args)['changed'])
            self.assertEqual(len(rules),1)
            self.assertTrue(firewall.privileged('remove',**args)['changed'])
            self.assertEqual(rules,[])
            self.assertEqual(json.loads(state.read_text()),{})
    def test_existing_user_rule_is_not_adopted_or_removed(self):
        rules,calls,run=self.fixture();rules.append(firewall.rule_args(NET))
        with tempfile.TemporaryDirectory() as folder:
            args=dict(interface=NET['interface'],address=NET['address'],network=NET['network'],current=[NET],run=run,state=Path(folder)/'state.json')
            self.assertFalse(firewall.privileged('allow',**args)['changed'])
            self.assertFalse(firewall.privileged('remove',**args)['changed'])
            self.assertEqual(len(rules),1)
    def test_old_network_permission_can_be_removed_after_disconnect(self):
        rules,calls,run=self.fixture()
        with tempfile.TemporaryDirectory() as folder:
            args=dict(interface=NET['interface'],address=NET['address'],network=NET['network'],run=run,state=Path(folder)/'state.json')
            firewall.privileged('allow',current=[NET],**args)
            self.assertTrue(firewall.privileged('remove',current=[],**args)['changed'])
            self.assertEqual(rules,[])
    def test_network_change_and_unrecognised_operation_cannot_mutate(self):
        rules,calls,run=self.fixture()
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):firewall.privileged('allow','wlan0','192.168.10.5','0.0.0.0/0',current=[NET],run=run,state=Path(folder)/'state')
            with self.assertRaises(ValueError):firewall.privileged('disable',run=run)
        self.assertEqual(rules,[])
    def test_discovery_excludes_loopback_vpn_containers_and_public_networks(self):
        def item(name,ip):return {'ifname':name,'flags':['UP'],'addr_info':[{'family':'inet','scope':'global','local':ip,'prefixlen':24}]}
        result=firewall.candidates([item('wlan0','192.168.10.5'),item('docker0','172.17.0.1'),item('wg0','10.0.0.1'),item('eth0','8.8.8.8')])
        self.assertEqual(result,[NET])
