'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../../..');
const yaml=require(path.join(source,'app/desktop/node_modules/js-yaml'));
process.stdout.write(JSON.stringify(yaml.load(fs.readFileSync(process.argv[2],'utf8'))));
