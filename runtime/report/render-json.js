function renderJson(model) {
  return `${JSON.stringify(model, null, 2)}\n`;
}

export {
  renderJson
};
