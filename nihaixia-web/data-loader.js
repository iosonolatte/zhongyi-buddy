/* 数据加载：将离线 JSON 载入 window.DATA */
window.DATA = window.DATA || {};

async function _loadJSON(name) {
  const r = await fetch('data/' + name);
  if (!r.ok) throw new Error('加载失败：' + name);
  return r.json();
}

window.loadAllData = async function () {
  const [formulas, herbs, acu] = await Promise.all([
    _loadJSON('formulas.json'),
    _loadJSON('herbs.json'),
    _loadJSON('acupuncture.json'),
  ]);
  window.DATA.formulas = formulas.formulas || formulas;
  window.DATA.herbs = herbs.herbs || herbs;
  window.DATA.acupuncture = acu;
  return window.DATA;
};
