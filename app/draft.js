// A detached draft: editing never mutates the last saved configuration.
class DeckDraft {
  constructor(config) { this.accept(config); }
  accept(config) {
    this.saved = JSON.parse(JSON.stringify(config));
    this.value = JSON.parse(JSON.stringify(config));
  }
  get dirty() { return JSON.stringify(this.value) !== JSON.stringify(this.saved); }
  discard() { this.value = JSON.parse(JSON.stringify(this.saved)); }
  put(button, position) {
    const buttons = this.value.buttons.filter(b => b.id !== button.id);
    buttons.splice(Math.min(buttons.length, Math.max(0, position - 1)), 0, {...button});
    this.value.buttons = buttons;
  }
  remove(id) { this.value.buttons = this.value.buttons.filter(b => b.id !== id); }
}
if (typeof module !== 'undefined') module.exports = DeckDraft;
