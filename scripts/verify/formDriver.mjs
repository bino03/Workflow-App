// Typing into forms from a CDP session, shared by the Projects scenarios (project-drawer, project-deploys,
// project-info-e2e). `page` is what `openBrowser()` returns.

export function formDriver(page) {
  return {
    /** Replaces the content of a field like a user: focus, select everything, type over it. */
    async fill(selector, text) {
      await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select(); })()`);
      await page.send('Input.insertText', { text });
    },

    /**
     * A datetime-local is segmented: Input.insertText cannot type into it. This sets the value the way the browser
     * ends up with it after a user picks a date (the native setter + an input event, which is what React listens to).
     */
    async setDateTime(selector, value) {
      await page.evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
      );
    },

    /** Picks an option of an antd Select (opened by a mousedown on its root). */
    async choose(selectId, optionTitle) {
      await page.evaluate(`document.querySelector('#${selectId}').closest('.ant-select').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
      const found = await page.waitFor(`!![...document.querySelectorAll('.ant-select-item-option')].find((o) => o.getAttribute('title') === ${JSON.stringify(optionTitle)})`);
      if (!found) throw new Error(`option ${optionTitle} not offered`);
      await page.evaluate(`[...document.querySelectorAll('.ant-select-item-option')].find((o) => o.getAttribute('title') === ${JSON.stringify(optionTitle)}).click()`);
    },
  };
}
