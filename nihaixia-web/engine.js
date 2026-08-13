/* 中医Buddy · 六经辨证诊断引擎 — 移植自 diagnostic_engine.dart
 * 依赖 rules-a.js / rules-b.js (window.RULES) 与 diagnose.js (原型上的辨证方法)
 */
(function (global) {
  'use strict';
  const R = global.RULES;

  const STAGES = {
    chiefComplaint: 'chiefComplaint',
    temperaturePattern: 'temperaturePattern',
    tonguePulse: 'tonguePulse',
    tenQuestions: 'tenQuestions',
    meridianLocation: 'meridianLocation',
    result: 'result',
  };

  // 寒热模式「只怕冷不发热」(chills_no_fever) 的初始经别方向——太阴/少阴未分。
  // 这是问诊过程中的「模糊态」，需结合舌脉(_adjustMeridianBy*)与十问评分
  // (_decideMeridianDirection) 最终收窄为「太阴」或「少阴」。
  // 注意：rules-a.js / rules-b.js 里的同名串是数据（展示/匹配用），不属于本常量范畴。
  const UNRESOLVED_COLD_MERIDIAN = '太阴/少阴';

  class DiagnosticEngine {
    constructor() { this.reset(); }

    reset() {
      this._stage = STAGES.chiefComplaint;
      this._selectedSymptoms = [];
      this._meridianDirection = null;
      this._combinedMeridian = null;
      this._combinedPatternCondition = null;
      this._answers = {};
      this._tenQuestionIndex = 0;
      this._tongueCoating = null;
      this._tongueShape = null;
      this._pulseType = null;
      this._gender = null;
      this._formulas = [];
    }

    setFormulas(formulas) { this._formulas = formulas || []; }

    get stage() { return this._stage; }
    get selectedSymptoms() { return this._selectedSymptoms.slice(); }
    get tenQuestionIndex() { return this._tenQuestionIndex; }
    get meridianDirection() { return this._meridianDirection; }

    getInitialGreeting() {
      return '你好，我是中医Buddy辨证助手。\n\n我将按照倪海厦老师的辨证方法，通过七步问诊帮你分析：\n1️⃣ 主诉症状\n2️⃣ 寒热辨经\n3️⃣ 舌诊脉诊（望诊）\n4️⃣ 倪海厦十问\n5️⃣ 六经定位\n6️⃣ 鉴别诊断\n7️⃣ 用药指导\n\n请告诉我你哪里不舒服？';
    }

    getChiefComplaintOptions() { return R.chiefComplaints; }
    getTemperatureQuestions() { return R.temperaturePatterns; }
    getFollowUpQuestions(meridian) { return R.followUpQuestions[meridian] || []; }
    getTongueCoatingOptions() { return R.tongueCoatingOptions; }
    getTongueShapeOptions() { return R.tongueShapeOptions; }
    getPulseOptions() { return R.pulseOptions; }

    getTenQuestions() {
      // 原版支持通过设置页预设性别(defaultGender)来跳过性别题，网页版无设置页，故仅返回完整十问。
      return R.tenQuestions.slice();
    }

    // ---- 主诉
    selectChiefComplaint(symptomKey) {
      this._selectedSymptoms.push(symptomKey);
      this._answers[symptomKey] = true;
      this._stage = STAGES.temperaturePattern;
    }

    // ---- 寒热辨经
    answerTemperaturePattern(patternKey) {
      this._meridianDirection = R.temperatureToMeridian[patternKey];
      this._answers['temperature'] = patternKey;
      this._stage = STAGES.tonguePulse;
    }

    // ---- 舌诊脉诊
    answerTonguePulse(opts) {
      const { tongueCoating, tongueShape, pulseType } = opts || {};
      this._tongueCoating = tongueCoating;
      this._tongueShape = tongueShape;
      this._pulseType = pulseType;
      if (tongueCoating != null) {
        this._answers['tongue_coating'] = tongueCoating;
        if (tongueCoating === '黄厚' || tongueCoating === '黄薄') this._answers['tongue_red_coated_yellow'] = true;
        if (tongueCoating === '白厚' || tongueCoating === '薄白') this._answers['tongue_pale_coated_white'] = true;
        this._adjustMeridianByTongue('tongue_coating', tongueCoating);
      }
      if (tongueShape != null) {
        this._answers['tongue_shape'] = tongueShape;
        if (tongueShape === '淡白') this._answers['tongue_pale_coated_white'] = true;
        if (tongueShape === '红') this._answers['tongue_red_coated_yellow'] = true;
        if (tongueShape === '绛紫') this._answers['tongue_purple'] = true;
        if (tongueShape === '胖大' || tongueShape === '齿痕') this._answers['tongue_swollen'] = true;
      }
      if (pulseType != null) {
        this._answers['pulse_type'] = pulseType;
        this._adjustMeridianByPulse(pulseType);
      }
      this._stage = STAGES.tenQuestions;
      this._tenQuestionIndex = 0;
    }

    _adjustMeridianByTongue(type, value) {
      // 仅「黄厚苔」这一条有直接定经价值（阳明腑实典型舌象）。
      // 舌质（红/淡白/胖大/绛紫等）的影响不在此处处理——已通过
      // tongue_red_coated_yellow / tongue_pale_coated_white / tongue_purple / tongue_swollen
      // 等布尔标志在 _decideMeridianDirection 的评分系统中体现。
      if (type !== 'tongue_coating') return;
      if (value === '黄厚' && this._meridianDirection === UNRESOLVED_COLD_MERIDIAN) {
        this._meridianDirection = '阳明';
      }
    }

    _adjustMeridianByPulse(pulse) {
      // 仅当经别仍为模糊态「太阴/少阴」时，用有定经意义的脉象收窄方向；
      // 其余脉象（滑/涩/缓/弱/迟/数等）不参与定经，留待评分系统综合判断。
      if ((pulse === '浮' || pulse === '紧') && this._meridianDirection === UNRESOLVED_COLD_MERIDIAN && this._answers['temperature'] === 'fever_chills') {
        this._meridianDirection = '太阳';
      } else if (pulse === '洪' && this._meridianDirection === UNRESOLVED_COLD_MERIDIAN) {
        this._meridianDirection = '阳明';
      } else if (pulse === '弦' && this._meridianDirection === UNRESOLVED_COLD_MERIDIAN) {
        this._meridianDirection = '少阳';
      } else if ((pulse === '微' || pulse === '细') && this._meridianDirection === UNRESOLVED_COLD_MERIDIAN) {
        this._meridianDirection = '少阴';
      } else if (pulse === '沉' && this._meridianDirection === '太阳') {
        this._meridianDirection = UNRESOLVED_COLD_MERIDIAN;
      }
    }

    // ---- 十问
    answerTenQuestion(questionKey, answer) {
      if (questionKey === 'temperature') this._answers['temp_question'] = answer;
      else this._answers[questionKey] = answer;

      if (questionKey === 'gender') {
        this._gender = answer === '男' ? 'male' : 'female';
        this._tenQuestionIndex++;
        if (this._gender === 'male') this._skipMenstrual();
        if (this._tenQuestionIndex >= R.tenQuestions.length) this._decideMeridianDirection();
        return;
      }

      if (answer === '没有此症状') {
        this._tenQuestionIndex++;
        if (this._gender === 'male') this._skipMenstrual();
        if (this._tenQuestionIndex >= R.tenQuestions.length) this._decideMeridianDirection();
        return;
      }

      if (questionKey === 'sleep') {
        this._answers['sleep_quality'] = answer;
        this._answers['insomnia'] = !answer.includes('一觉到天亮');
        this._answers['early_wake_1_3'] = answer.includes('1-3');
        this._answers['early_wake_3_5'] = answer.includes('3-5');
      }
      if (questionKey === 'thirst') {
        this._answers['thirsty'] = answer.includes('渴');
        this._answers['cold_drink'] = answer.includes('冷水');
        this._answers['hot_drink'] = answer.includes('热水');
        this._answers['thirst_no_drink'] = answer.includes('渴但不想喝');
        this._answers['xiaoke'] = answer.includes('消渴');
        this._answers['thirst_strong'] = answer.includes('渴') && answer.includes('冷水');
        this._answers['no_thirst'] = answer === '不渴';
        this._answers['mouth_dry'] = answer.includes('口干');
      }
      if (questionKey === 'stool') {
        this._answers['constipated'] = answer.includes('便秘');
        this._answers['diarrhea'] = answer.includes('稀') || answer.includes('拉肚子') || answer.includes('水样');
        this._answers['bloody_stool'] = answer.includes('脓血');
      }
      if (questionKey === 'urine') {
        this._answers['urine_clear'] = answer.includes('清长');
        this._answers['urine_difficult'] = answer.includes('不利');
        this._answers['urine_nocturia'] = answer.includes('夜尿');
      }
      if (questionKey === 'temperature') {
        this._answers['cold_limbs'] = answer.includes('冰冷');
        this._answers['warm_limbs'] = answer.includes('温热');
        this._answers['hot_palms_soles'] = answer.includes('手心脚心热');
        this._answers['upper_heat_lower_cold'] = answer.includes('头热脚冷') || answer.includes('上半身热');
        this._answers['chills'] = answer.includes('全身怕冷');
        this._answers['no_chills'] = !answer.includes('冷');
        this._answers['alternating_chills'] = answer.includes('往来寒热') || answer.includes('忽冷忽热');
      }
      if (questionKey === 'sweating') {
        this._answers['no_sweat'] = answer.includes('不容易出汗');
        this._answers['has_sweat'] = this._answers['no_sweat'] !== true && (answer.includes('出汗') || answer.includes('盗汗') || answer.includes('自汗'));
        this._answers['night_sweat'] = answer.includes('盗汗');
        this._answers['head_sweat'] = answer.includes('头汗');
        this._answers['hand_foot_sweat'] = answer.includes('手足汗');
        this._answers['sweating'] = this._answers['has_sweat'] === true;
        this._answers['profuse_sweat'] = answer.includes('大汗');
      }
      if (questionKey === 'energy') {
        this._answers['drowsy'] = answer.includes('欲寐') || answer.includes('昏昏沉沉');
        this._answers['irritable'] = answer.includes('烦躁');
        this._answers['weak_speech'] = answer.includes('说话没力气');
        this._answers['qi_rushing'] = answer.includes('气上撞心') || answer.includes('气往上冲');
      }
      if (questionKey === 'pain') {
        this._answers['headache_front'] = answer.includes('前额');
        this._answers['headache_side'] = answer.includes('两侧');
        this._answers['headache_back'] = answer.includes('后脑');
        this._answers['chest_pain'] = answer.includes('胸胁');
        this._answers['abdomen_pain_press'] = answer.includes('拒按') || answer.includes('按了更痛') || answer.includes('压痛');
        this._answers['abdomen_pain_relief'] = answer.includes('喜按') || answer.includes('按了舒服');
        this._answers['joint_wandering'] = answer.includes('游走');
        this._answers['body_joint_pain'] = answer.includes('身体痛') && answer.includes('骨节');
        this._answers['body_pain'] = answer.includes('身体痛');
        this._answers['joint_pain'] = answer.includes('骨节');
        this._answers['epigastric_fullness'] = answer.includes('心下痞');
        this._answers['chest_fullness'] = answer.includes('心下痞') || answer.includes('满');
      }
      if (questionKey === 'menstrual') {
        this._answers['menstrual_pain'] = answer.includes('痛经');
        this._answers['menstrual_irregular'] = answer.includes('不调') || answer.includes('先后无定期');
        this._answers['menstrual_excess'] = answer.includes('量多');
        this._answers['menstrual_deficient'] = answer.includes('量少');
        this._answers['sexual_deficiency'] = answer.includes('性功能减退');
      }

      this._tenQuestionIndex++;
      if (this._gender === 'male') this._skipMenstrual();
      if (this._tenQuestionIndex >= R.tenQuestions.length) this._decideMeridianDirection();
    }

    _skipMenstrual() {
      const q = R.tenQuestions[this._tenQuestionIndex];
      if (q && q.key === 'menstrual') this._tenQuestionIndex++;
    }

    // ---- 六经定位
    _decideMeridianDirection() {
      // 修复原引擎：将方向写入 _answers['meridian'] 以便跟进问诊派生标志生效
      if (this._meridianDirection == null || this._meridianDirection === UNRESOLVED_COLD_MERIDIAN) {
        if (this._answers['temperature'] === 'fever_thirst_no_cold') {
          this._meridianDirection = '太阳';
        } else if (this._answers['temperature'] === 'fever_chills' && this._pulseType === '沉') {
          this._meridianDirection = '少阴';
          this._answers['_shaoyin_with_table'] = true;
        } else if (this._answers['temperature'] === 'fever_no_cold' ||
          (this._answers['thirst_strong'] === true && this._answers['constipated'] === true)) {
          this._meridianDirection = '阳明';
        } else if (this._answers['temperature'] === 'alternating_chills_fever' ||
          this._answers['bitter_mouth'] === true) {
          this._meridianDirection = '少阳';
        } else if (this._answers['temperature'] === 'upper_heat_lower_cold' ||
          (this._answers['upper_heat_lower_cold'] === true && this._answers['xiaoke'] === true)) {
          this._meridianDirection = '厥阴';
        } else if (this._meridianDirection == null || this._meridianDirection === UNRESOLVED_COLD_MERIDIAN) {
          let shaoyinScore = 0, taiyinScore = 0;
          if (this._answers['drowsy'] === true) shaoyinScore += 4;
          if (this._answers['cold_limbs'] === true) shaoyinScore += 3;
          if (this._answers['urine_clear'] === true) shaoyinScore += 3;
          if (this._answers['palpitation'] === true) shaoyinScore += 2;
          if (this._answers['weak_speech'] === true) shaoyinScore += 1;
          if (this._answers['diarrhea'] === true) taiyinScore += 3;
          if (this._answers['tongue_pale_coated_white'] === true) taiyinScore += 2;
          if (this._answers['tongue_swollen'] === true) taiyinScore += 2;
          if (this._answers['abdomen_pain_relief'] === true) taiyinScore += 2;
          if (this._answers['appetite'] === '吃不下') taiyinScore += 2;
          if (this._answers['no_thirst'] === true) taiyinScore += 2;
          if (this._answers['thirsty'] === true && this._answers['hot_drink'] === true) shaoyinScore += 1;
          if (this._pulseType === '微' || this._pulseType === '细') shaoyinScore += 3;
          if (this._pulseType === '弱' || this._pulseType === '缓') taiyinScore += 2;
          if (shaoyinScore > taiyinScore) this._meridianDirection = '少阴';
          else if (taiyinScore > shaoyinScore) this._meridianDirection = '太阴';
          else this._meridianDirection = '少阴';
        }
      }
      this._answers['meridian'] = this._meridianDirection;
      this._detectCombinedPattern();
      this._detectTaiyinShaoyinBoundary();
      this._stage = STAGES.meridianLocation;
    }

    _detectTaiyinShaoyinBoundary() {
      if (this._meridianDirection === '太阴') {
        let hasShaoyinSigns = false;
        if (this._answers['drowsy'] === true) hasShaoyinSigns = true;
        if (this._pulseType === '微' || this._pulseType === '细') hasShaoyinSigns = true;
        if (this._answers['cold_limbs'] === true && this._answers['urine_clear'] === true) hasShaoyinSigns = true;
        if (hasShaoyinSigns) this._answers['_taiyin_to_shaoyin'] = true;
      }
    }

    _detectCombinedPattern() {
      const primary = this._meridianDirection;
      if (primary == null) return;
      let sunScore = 0, yangmingScore = 0, shaoyangScore = 0, taiyinScore = 0, shaoyinScore = 0, jueyinScore = 0;
      if (this._answers['temperature'] === 'fever_chills') sunScore += 3;
      if (this._answers['has_sweat'] === false) sunScore += 2;
      if (this._answers['cold_limbs'] !== true) sunScore += 1;
      if (this._answers['headache'] === true) sunScore += 1;
      if (this._answers['neck_stiff'] === true) sunScore += 1;
      if (this._answers['thirsty'] === true) yangmingScore += 2;
      if (this._answers['constipated'] === true) yangmingScore += 3;
      if (this._answers['hot_palms_soles'] === true) yangmingScore += 2;
      if (this._answers['temperature'] === 'fever_thirst_no_cold') yangmingScore += 3;
      if (this._answers['bitter_mouth'] === true) shaoyangScore += 3;
      if (this._answers['dry_throat'] === true) shaoyangScore += 2;
      if (this._answers['temperature'] === 'alternating_chills_fever') shaoyangScore += 3;
      if (this._answers['nausea'] === true) shaoyangScore += 1;
      if (this._answers['diarrhea'] === true) taiyinScore += 2;
      if (this._answers['tongue_pale_coated_white'] === true) taiyinScore += 2;
      if (this._answers['abdominal_pain'] === true) taiyinScore += 2;
      if (this._answers['drowsy'] === true) shaoyinScore += 3;
      if (this._answers['cold_limbs'] === true) shaoyinScore += 2;
      if (this._answers['urine_clear'] === true) shaoyinScore += 2;
      if (this._answers['pulse_thin_weak'] === true) shaoyinScore += 2;
      if (this._answers['upper_heat_lower_cold'] === true) jueyinScore += 3;
      if (this._answers['thirst_no_drink'] === true) jueyinScore += 2;
      if (this._answers['hunger_no_eat'] === true) jueyinScore += 2;

      if (primary === '太阳' && yangmingScore >= 3) {
        this._combinedMeridian = '阳明';
        if (this._answers['irritable'] === true && this._answers['has_sweat'] === false) this._combinedPatternCondition = 'sun+yangming_interior_heat';
        else if (this._answers['nausea'] === true || this._answers['vomiting'] === true) this._combinedPatternCondition = 'sun+yangming_vomit';
        else if ((this._answers['breathing'] && this._answers['breathing'].includes('喘')) || this._answers['chest_fullness'] === true) this._combinedPatternCondition = 'sun+yangming_chest_full';
        else if (this._answers['has_sweat'] === true && yangmingScore < 5) this._combinedPatternCondition = 'sun+yangming_unresolved';
      } else if (primary === '太阳' && shaoyinScore >= 3) {
        this._combinedMeridian = '少阴';
        this._combinedPatternCondition = 'sun+shaoyin_two_cold';
      } else if (primary === '太阳' && shaoyangScore >= 2) {
        this._combinedMeridian = '少阳';
        if (this._answers['diarrhea'] === true) this._combinedPatternCondition = 'sun+shaoyang_diarrhea';
        else if (this._answers['nausea'] === true || this._answers['vomiting'] === true) this._combinedPatternCondition = 'sun+shaoyang_vomit';
      } else if (primary === '少阳' && yangmingScore >= 3) {
        this._combinedMeridian = '阳明';
        if (this._answers['tidal_fever'] === true) this._combinedPatternCondition = 'shaoyang+yangming_tidal_fever';
      } else if (primary === '太阴' && shaoyinScore >= 3) {
        this._combinedMeridian = '少阴';
      } else if (primary === '太阳' && yangmingScore >= 2 && shaoyangScore >= 2) {
        this._combinedMeridian = '阳明少阳';
        if (this._answers['drowsy'] === true && this._answers['has_sweat'] === true) this._combinedPatternCondition = 'three_yang_sleep';
      } else if (primary === '阳明' && shaoyinScore >= 3) {
        this._combinedMeridian = '少阴';
        this._combinedPatternCondition = 'yangming+shaoyin_urgent';
      } else if (primary === '厥阴' && shaoyangScore >= 2) {
        this._combinedMeridian = '少阳';
        this._combinedPatternCondition = 'jueyin+shaoyang';
      } else if (primary === '少阳' && jueyinScore >= 2) {
        this._combinedMeridian = '厥阴';
        this._combinedPatternCondition = 'jueyin+shaoyang';
      } else if (primary === '少阳' && taiyinScore >= 3) {
        this._combinedMeridian = '太阴';
        this._combinedPatternCondition = 'shaoyang+taiyin';
      } else if (primary === '太阳' && taiyinScore >= 3) {
        this._combinedMeridian = '太阴';
        this._combinedPatternCondition = 'sun+taiyin';
      } else if (primary === '太阳' && yangmingScore >= 3 && this._answers['diarrhea'] === true) {
        this._combinedMeridian = '阳明';
        this._combinedPatternCondition = 'sun+yangming_diarrhea_heat';
      }
    }

    answerFollowUp(questionKey, answer) {
      this._answers[questionKey] = answer;
      if (answer !== '没有此症状') this._selectedSymptoms.push(answer);
      if (questionKey === 'throat') {
        this._answers['sore_throat'] = answer.includes('痛');
        this._answers['throat_ulcer'] = answer.includes('生疮');
        this._answers['difficulty_speak'] = answer.includes('不能') && answer.includes('说话');
        this._answers['throat_pus'] = answer.includes('化脓');
      }
      if (questionKey === 'sputum') this._answers['bloody_sputum'] = answer.includes('脓血');
      if (questionKey === 'treatment_history') this._answers['history_mistreatment'] = answer.includes('误下') || answer.includes('被误下');
      if (questionKey === 'vomiting') this._answers['vomiting'] = answer.includes('呕') || answer.includes('吐');
      if (questionKey === 'diarrhea') {
        this._answers['severe_diarrhea'] = answer.includes('清谷') || answer.includes('完谷不化');
        this._answers['bloody_stool'] = answer.includes('脓血');
      }
      if (questionKey === 'sweating' && this._answers['meridian'] === '太阳') {
        this._answers['has_sweat'] = answer.includes('有汗');
        this._answers['no_sweat'] = answer.includes('没汗');
        this._answers['profuse_sweat'] = answer.includes('汗出不止');
      }
      if (questionKey === 'breathing') {
        this._answers['cough'] = answer.includes('咳嗽');
        this._answers['asthma'] = answer.includes('气喘') || answer.includes('喘');
        this._answers['phlegm_cold'] = answer.includes('白痰');
        this._answers['phlegm_hot'] = answer.includes('黄痰');
      }
      if (questionKey === 'speech') {
        this._answers['delirium'] = answer.includes('胡话') || answer.includes('谵语');
        this._answers['restlessness'] = answer.includes('烦躁');
        this._answers['chest_discomfort'] = answer.includes('懊憹');
      }
      if (questionKey === 'tidal_fever') {
        this._answers['tidal_fever'] = answer.includes('潮热');
        this._answers['jaundice'] = answer.includes('身黄');
      }
      if (questionKey === 'bitter_mouth') {
        this._answers['bitter_mouth'] = answer.includes('苦');
        this._answers['shaoyang_triad'] = answer.includes('口苦') && answer.includes('咽干') && answer.includes('目眩');
      }
      if (questionKey === 'spirit') {
        this._answers['drowsy'] = answer.includes('但欲寐') || answer.includes('昏昏沉沉');
        this._answers['day_night_different'] = answer.includes('昼日烦躁');
      }
      if (questionKey === 'extremities' && this._answers['meridian'] === '少阴') {
        this._answers['cold_limbs'] = answer.includes('冰冷');
        this._answers['hot_limbs'] = answer.includes('手脚心热');
        this._answers['hand_foot_cold_pulse_fine'] = answer.includes('脉细欲绝');
      }
      if (questionKey === 'pain' && this._answers['meridian'] === '少阴') {
        this._answers['body_joint_pain'] = answer.includes('身体痛') && answer.includes('骨节');
        this._answers['body_pain'] = answer.includes('身体痛');
        this._answers['joint_pain'] = answer.includes('骨节');
        this._answers['heavy_limbs_pain'] = answer.includes('四肢沉重');
      }
      if (questionKey === 'table') this._answers['shaoyin_with_table'] = answer.includes('发热') || answer.includes('反发热');
      if (questionKey === 'chest_sensation') {
        this._answers['qi_rushing'] = answer.includes('气上撞心');
        this._answers['heart_heat'] = answer.includes('心中疼热');
        this._answers['vomit_frogs'] = answer.includes('吐涎沫');
      }
      if (questionKey === 'appetite' && this._answers['meridian'] === '厥阴') {
        this._answers['hungry_no_eat'] = answer.includes('饿但不想吃');
        this._answers['vomit_on_eat'] = answer.includes('食谷欲呕');
      }
      if (questionKey === 'extremities' && this._answers['meridian'] === '厥阴') {
        this._answers['alternating_hot_cold'] = answer.includes('时冷时热');
        this._answers['hand_foot_cold_pulse_fine'] = answer.includes('脉细欲绝');
      }
      if (questionKey === 'chest') {
        this._answers['chest_fullness'] = answer.includes('满') || answer.includes('痞');
        if (this._answers['meridian'] === '太阳') {
          this._answers['chest_pain'] = answer.includes('心下') || answer.includes('胸');
        }
      }
    }
    // __END_FOLLOWUP__

    _calculateConfidence(meridian) {
      let weight = 0, count = 0;
      for (const [key, value] of Object.entries(this._answers)) {
        if (Object.prototype.hasOwnProperty.call(R.symptomWeights, key) && value === true) {
          weight += R.symptomWeights[key]; count++;
        }
      }
      if (count === 0) return 0.8;
      return Math.min(0.95, Math.max(0.7, weight / count));
    }

    _matchDifferential(meridian, pattern) {
      let matchKey;
      if (meridian === '太阳') {
        if (pattern.includes('中风') || pattern.includes('桂枝汤')) matchKey = '太阳中风_vs_伤寒';
        else if (pattern.includes('大青龙') || pattern.includes('小青龙')) matchKey = '大青龙_vs_小青龙';
        else if (pattern.includes('麻黄') && !pattern.includes('杏甘石')) matchKey = '麻黄_vs_麻杏甘石';
      } else if (meridian === '阳明') {
        if (pattern.includes('白虎')) {
          if (this._answers['thirst_strong'] === true || this._answers['heavy_sweat'] === true) matchKey = '白虎_vs_白虎人参';
          else matchKey = '白虎_承气';
        } else if (pattern.includes('承气') || pattern.includes('便秘')) matchKey = '承气_vs_麻子仁';
      } else if (meridian === '少阳') {
        if (pattern.includes('柴胡') && this._answers['constipated'] === true) matchKey = '小柴胡_vs_大柴胡';
      } else if (meridian === '太阴') {
        if (pattern.includes('理中')) {
          if (this._answers['cold_limbs'] === true || this._answers['drowsy'] === true) matchKey = '理中_vs_四逆';
          else matchKey = '小建中_vs_理中';
        }
      } else if (meridian === '少阴') {
        if (pattern.includes('真武') || pattern.includes('水饮')) {
          if (this._answers['body_pain'] === true || this._answers['joint_pain'] === true) matchKey = '真武_vs_附子汤';
          else matchKey = '苓桂术甘_vs_真武';
        } else if (pattern.includes('四逆')) {
          if (this._answers['irritability'] === true) matchKey = '四逆_vs_茯苓四逆_vs_干姜附子';
          else if (this._answers['upper_heat_lower_cold'] === true) matchKey = '四逆_vs_通脉四逆';
        }
      } else if (meridian === '厥阴') {
        if (pattern.includes('乌梅')) matchKey = '乌梅丸_vs_当归四逆';
        else if (pattern.includes('当归四逆')) matchKey = '当归四逆_vs_四逆';
        else if (pattern.includes('吴茱萸')) matchKey = '吴茱萸_vs_四逆';
      }
      if (matchKey == null && meridian === '少阴') {
        if (this._answers['drowsy'] === true && this._answers['cold_limbs'] === true && this._answers['irritable'] === true) {
          matchKey = '茯苓四逆_vs_干姜附子';
        }
      }
      if (matchKey == null && pattern.includes('虚烦')) matchKey = '栀子豉_vs_黄连阿胶';
      if (matchKey == null && pattern.includes('痞')) matchKey = '半夏泻心_vs_生姜泻心_vs_甘草泻心';
      if (matchKey == null) return null;
      const d = R.differentialDiagnoses[matchKey];
      if (!d) return null;
      return { name1: d.name1, formula1: d.formula1, name2: d.name2, formula2: d.formula2, keyDifference: d.keyDifference, details: d.details };
    }

    _getCareAdvice(meridian) {
      const advice = R.careAdvice[meridian];
      if (!advice) return null;
      return { 饮食: advice.diet, 休息: advice.rest, 艾灸: advice.moxibustion, 禁忌: advice.avoid };
    }

    _detectPulseTongueContradiction() {
      if (this._pulseType == null) return null;
      let warning, suggestion;
      if (this._pulseType === '数' && (this._tongueShape === '淡白' || this._tongueShape === '淡红')) {
        warning = '⚠️ 脉数（热象）但舌淡白（虚寒），脉舌矛盾';
        suggestion = '以舌为准→真寒假热可能。查：渴喜热饮？小便清长？四肢厥冷？按之脉无力？';
      } else if (this._pulseType === '迟' && (this._tongueShape === '红' || this._tongueShape === '绛紫')) {
        warning = '⚠️ 脉迟（寒象）但舌红（热象），脉舌矛盾';
        suggestion = '以舌为准→真热假寒可能。查：胸腹热？渴喜冷饮？小便黄赤？';
      } else if (this._pulseType === '浮' && (this._tongueCoating === '白厚' || this._tongueCoating === '黄厚')) {
        warning = '⚠️ 脉浮（表证）但苔厚腻（里证），脉舌矛盾';
        suggestion = '以舌为准→里证为主，脉浮为假象。可能为真寒假热。';
      } else if (this._pulseType === '沉' && this._tongueCoating === '薄白') {
        warning = '⚠️ 脉沉（里证）但苔薄白（正常/表证），脉舌不一致';
        suggestion = '可能为里证初起或表证已解，需结合问诊判断。';
      } else if (this._pulseType === '弦' && (this._tongueShape === '淡白' || this._tongueShape === '淡红') && this._tongueCoating === '白厚') {
        warning = '⚠️ 脉弦（少阳）但舌淡苔白（太阴虚寒），寒热矛盾';
        suggestion = '以舌为准→少阳兼太阴虚。柴胡桂枝干姜汤证可能。';
      }
      if (warning != null) return warning + '\n💡 ' + suggestion;
      const key = this._pulseType + '脉+' + this._tongueCoating + '苔';
      const c = R.pulseTongueContradictions[key];
      if (c) return c.warning + '\n💡 ' + c.suggestion;
      return null;
    }

    _detectPulseCombination() {
      if (this._pulseType == null) return null;
      for (const pc of R.pulseCombinations) {
        if (this._pulseType === pc.pulse1) return pc;
      }
      return null;
    }

    _detectBloodStasis() {
      let has = false;
      if (this._tongueShape === '绛紫') has = true;
      if (this._pulseType === '涩') has = true;
      if (has) return R.bloodStasisFiveMethods;
      return null;
    }

    _detectSweatingContraindications() {
      const meridian = this._meridianDirection;
      if (meridian == null) return null;
      const result = [];
      if (['阳明', '少阳', '太阴', '少阴', '厥阴'].includes(meridian)) {
        for (const sc of R.sweatingContraindications) {
          if (sc.condition.includes(meridian) || sc.condition.includes('津液')) result.push(sc);
        }
      }
      if (this._answers['throat'] === '咽干') result.push(R.sweatingContraindications[5]);
      return result.length ? result : null;
    }

    _detectTransmission() {
      const meridian = this._meridianDirection;
      if (meridian == null) return null;
      for (const t of R.meridianTransmissions) {
        if (t.from !== meridian) continue;
        if (t.to === '阳明' && (this._answers['thirst_strong'] === true || this._answers['constipated'] === true)) return t;
        if (t.to === '少阳' && (this._answers['mouth_dry'] === true || this._answers['vomiting'] === true)) return t;
        if (t.to === '少阴' && (this._answers['drowsy'] === true || this._answers['cold_limbs'] === true) && (meridian === '太阳' || meridian === '太阴')) return t;
        if (t.to === '厥阴' && (this._answers['xiaoke'] === true || this._answers['upper_heat_lower_cold'] === true) && meridian === '少阴') return t;
      }
      return null;
    }

    _detectTrueFalseHeatCold() {
      const meridian = this._meridianDirection;
      if (meridian == null) return null;
      if (meridian === '少阴' || meridian === '太阴') {
        const upper = this._answers['upper_heat_lower_cold'] === true || this._answers['thirst_strong'] === true;
        const lower = this._answers['cold_limbs'] === true || this._answers['drowsy'] === true || this._answers['urine_clear'] === true;
        if (upper && lower) return R.trueFalseHeatColdData['真寒假热'];
      }
      if (meridian === '阳明' || meridian === '少阳') {
        const cold = this._answers['cold_limbs'] === true;
        const heat = this._answers['thirst_strong'] === true || this._answers['constipated'] === true || this._pulseType === '洪' || this._pulseType === '数';
        if (cold && heat) return R.trueFalseHeatColdData['真热假寒'];
      }
      return null;
    }

    _detectMedicationRules() {
      const meridian = this._meridianDirection;
      if (meridian == null) return null;
      const result = [];
      for (const rule of R.medicationRules) {
        if (rule.condition.includes(meridian)) result.push(rule);
      }
      return result.length ? result : null;
    }

    diagnose() {
      if (this._meridianDirection == null) return null;
      const meridian = this._meridianDirection;
      let result = this._diagnoseMiscellaneous(this._answers);
      if (result == null) {
        switch (meridian) {
          case '太阳': result = this._diagnoseTaiYang(this._answers); break;
          case '阳明': result = this._diagnoseYangMing(this._answers); break;
          case '少阳': result = this._diagnoseShaoYang(this._answers); break;
          case '太阴': result = this._diagnoseTaiYin(this._answers); break;
          case '少阴': result = this._diagnoseShaoYin(this._answers); break;
          case '厥阴': result = this._diagnoseJueYin(this._answers); break;
          default: return null;
        }
      }
      if (result == null) return null;

      const weightedConfidence = this._calculateConfidence(meridian);
      let combinedMeridian = this._combinedMeridian;
      let formulaOverride = result.formula;
      let finalConfidence = weightedConfidence;
      if (combinedMeridian != null) {
        if (combinedMeridian.includes('阳明') && combinedMeridian.includes('少阳')) combinedMeridian = '阳明';
        finalConfidence = weightedConfidence * 0.9;
        if (this._combinedPatternCondition != null) {
          for (const cp of R.combinedPatterns) {
            if (cp.condition === this._combinedPatternCondition) { formulaOverride = cp.formula; break; }
          }
        }
      }

      if (meridian === '太阳' && result.formula === '桂枝汤') {
        if (this._answers['weak_speech'] === true || this._answers['palpitation'] === true) {
          formulaOverride = '小建中汤';
          result = { meridian: result.meridian, pattern: '太阳表虚兼里虚（小建中汤证）', patternDetail: '桂枝汤证兼表阳虚，腹中痛，喜按。虚劳里急。', formula: '小建中汤', explanation: '经方两大补虚方之一。小建中汤=桂枝汤倍芍药加饴糖。表阳虚兼太阴脾虚，先补后解表。', confidence: 0.85, matchedSymptoms: this._selectedSymptoms };
        }
      }
      if (result.formula === '炙甘草汤' || this._pulseType === '结' || this._pulseType === '代') {
        if (this._answers['palpitation'] === true) {
          formulaOverride = '炙甘草汤';
          result = { meridian, pattern: '阴阳两虚（炙甘草汤证）', patternDetail: '脉结代，心动悸。阴阳两虚。', formula: '炙甘草汤', explanation: '经方两大补虚方之一。炙甘草汤补益气阴、通阳复脉。脉结代心动悸主方。', confidence: 0.9, matchedSymptoms: this._selectedSymptoms };
        }
      }

      let transmissionWarning;
      if (meridian === '太阳' && (this._answers['bitter_mouth'] === true || this._answers['dry_throat'] === true)) transmissionWarning = '⚠️ 太阳→少阳传经信号：口苦咽干，注意是否传入少阳';
      else if (meridian === '太阳' && (this._answers['thirst_strong'] === true || this._answers['constipated'] === true)) transmissionWarning = '⚠️ 太阳→阳明传经信号：大渴便秘，注意是否传入阳明';
      else if (meridian === '太阴' && (this._answers['drowsy'] === true || this._answers['urine_clear'] === true)) transmissionWarning = '⚠️ 太阴→少阴传经信号：但欲寐、小便清长，当从少阴论治';
      else if (meridian === '少阴' && (this._answers['upper_heat_lower_cold'] === true || this._answers['xiaoke'] === true)) transmissionWarning = '⚠️ 少阴→厥阴传经信号：寒热错杂，注意厥阴转化';

      let matchedMods;
      const mods = R.formulaModifications[result.formula];
      if (mods) {
        matchedMods = [];
        for (const mod of mods) {
          const sv = this._answers[mod.symptom];
          if (sv === true || (typeof sv === 'string' && sv.length && sv !== '没有' && sv !== '没有此症状')) matchedMods.push(mod);
        }
        if (matchedMods.length === 0) matchedMods = null;
      }
      const prescription = this.buildPrescription(formulaOverride, { modifications: matchedMods });
      const differential = this._matchDifferential(meridian, result.pattern);
      const careAdvice = this._getCareAdvice(meridian);
      const contradiction = this._detectPulseTongueContradiction();
      const trueFalseHC = this._detectTrueFalseHeatCold();
      const medRules = this._detectMedicationRules();
      const sweatContra = this._detectSweatingContraindications();
      const bloodStasis = this._detectBloodStasis();
      const pulseCombo = this._detectPulseCombination();
      const transmission = this._detectTransmission();

      return {
        meridian: result.meridian,
        pattern: result.pattern,
        patternDetail: result.patternDetail || '',
        formula: formulaOverride,
        explanation: result.explanation || '',
        confidence: finalConfidence,
        matchedSymptoms: result.matchedSymptoms || this._selectedSymptoms,
        combinedMeridian: combinedMeridian,
        tongueCoating: this._tongueCoating,
        tongueShape: this._tongueShape,
        pulseType: this._pulseType,
        careAdvice: careAdvice,
        differential: differential,
        prescription: prescription,
        answers: Object.assign({}, this._answers),
        pulseTongueContradiction: contradiction,
        trueFalseHeatCold: trueFalseHC,
        medicationRules: medRules,
        sweatingContraindications: sweatContra,
        bloodStasisSigns: bloodStasis,
        pulseCombination: pulseCombo,
        transmission: transmission,
        transmissionWarning: transmissionWarning,
      };
    }
  }

  global.DiagnosticEngine = DiagnosticEngine;
})(window);
