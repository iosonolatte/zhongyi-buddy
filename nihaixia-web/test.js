// 测试 harness：在 Node 中模拟 window，加载引擎与数据，跑几个辨证流程
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { window: {}, console };
vm.createContext(sandbox);
function load(file) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

load('rules-a.js');
load('rules-b.js');
load('engine.js');
load('diagnose.js');

const Engine = sandbox.window.DiagnosticEngine;
const formulas = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/formulas.json'), 'utf8')).formulas;

const engine = new Engine();
engine.setFormulas(formulas);

// 1) 收集所有公式名引用
const engineSrc = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8') + fs.readFileSync(path.join(__dirname, 'diagnose.js'), 'utf8');
const nameSet = new Set();
const re = /formula:\s*'([^']+)'/g; let m;
while ((m = re.exec(engineSrc))) nameSet.add(m[1]);
// 合并 patterns 中可能返回的组合名（如 桂枝加葛根汤/栝蒌桂枝汤）
const allNames = new Set();
nameSet.forEach((n) => {
  n.split('/').forEach((x) => allNames.add(x.trim()));
});
const formulaNames = new Set(formulas.map((f) => f.name));
const missing = [...allNames].filter((n) => !formulaNames.has(n));
console.log('=== 引用的方剂名数量:', allNames.size, ' 缺失:', missing.length);
console.log('缺失方剂:', missing.join(', '));

// 2) 跑几个流程
function runScenario(name, steps) {
  const e = new Engine();
  e.setFormulas(formulas);
  steps(e);
  const r = e.diagnose();
  console.log('\n--- 场景:', name, '---');
  if (!r) { console.log('  (无解)'); return; }
  console.log('  经:', r.meridian, '| 方:', r.formula, '| 置信:', r.confidence);
  console.log('  证:', r.pattern);
  console.log('  处方解析:', r.prescription ? (r.prescription.formulaName + ' (' + r.prescription.components.length + '味)') : 'NULL(未收录)');
  if (r.combinedMeridian) console.log('  合病:', r.combinedMeridian);
  if (r.transmissionWarning) console.log('  传变:', r.transmissionWarning);
}

// 太阳中风（桂枝汤）
runScenario('太阳中风·有汗恶风', (e) => {
  e.selectChiefComplaint('fever_chills');
  e.answerTemperaturePattern('fever_chills');
  e.answerTonguePulse({ tongueCoating: '薄白', tongueShape: '淡红', pulseType: '浮' });
  // 十问：跳过 gender（默认不触发），模拟有汗
  e.answerTenQuestion('sleep', '一觉到天亮');
  e.answerTenQuestion('appetite', '正常三餐');
  e.answerTenQuestion('stool', '每天有，成形');
  e.answerTenQuestion('urine', '5-7次淡黄色（正常）');
  e.answerTenQuestion('thirst', '不渴');
  e.answerTenQuestion('temperature', '手脚温热（正常）');
  e.answerTenQuestion('sweating', '稍微活动就出汗');
  e.answerTenQuestion('energy', '精力充沛');
  e.answerTenQuestion('pain', '不痛');
  e.answerTenQuestion('menstrual', '没有此症状');
  // 太阳跟进：有汗
  e.answerFollowUp('sweating', '有汗（中风→桂枝汤）');
});

// 少阴寒化（四逆汤）
runScenario('少阴寒化·但欲寐肢冷', (e) => {
  e.selectChiefComplaint('fatigue');
  e.answerTemperaturePattern('chills_no_fever');
  e.answerTonguePulse({ tongueCoating: '白厚', tongueShape: '淡白', pulseType: '微' });
  e.answerTenQuestion('sleep', '嗜睡但睡不够');
  e.answerTenQuestion('appetite', '没有胃口');
  e.answerTenQuestion('stool', '稀/拉肚子');
  e.answerTenQuestion('urine', '小便清长');
  e.answerTenQuestion('thirst', '不渴');
  e.answerTenQuestion('temperature', '手脚冰冷');
  e.answerTenQuestion('sweating', '不容易出汗');
  e.answerTenQuestion('energy', '但欲寐（昏昏沉沉想睡）');
  e.answerTenQuestion('pain', '不痛');
  e.answerTenQuestion('menstrual', '没有此症状');
  e.answerFollowUp('spirit', '但欲寐（昏昏沉沉想睡→少阴主证）');
  e.answerFollowUp('extremities', '冰冷（少阴寒化→四逆汤）');
});

// 阳明腑实（大承气）
runScenario('阳明腑实·便秘谵语潮热', (e) => {
  e.selectChiefComplaint('constipation');
  e.answerTemperaturePattern('fever_no_cold');
  e.answerTonguePulse({ tongueCoating: '黄厚', tongueShape: '红', pulseType: '洪' });
  e.answerTenQuestion('sleep', '整夜睡不着');
  e.answerTenQuestion('appetite', '特别能吃');
  e.answerTenQuestion('stool', '便秘，好几天一次');
  e.answerTenQuestion('urine', '次数少颜色深');
  e.answerTenQuestion('thirst', '大渴（阳明）');
  e.answerTenQuestion('temperature', '手心脚心热');
  e.answerTenQuestion('sweating', '大汗出（阳明）');
  e.answerTenQuestion('energy', '烦躁不安');
  e.answerTenQuestion('pain', '腹痛拒按');
  e.answerTenQuestion('menstrual', '没有此症状');
  e.answerFollowUp('stool', '便秘+腹满痛拒按+谵语（→大承气汤）');
  e.answerFollowUp('speech', '有说胡话（→承气汤）');
  e.answerFollowUp('tidal_fever', '下午3-5点发热（潮热→大承气汤）');
});
