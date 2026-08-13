/* 中医Buddy · 辨证方法（六经定位 + 杂病） — 移植自 diagnostic_engine.dart
 * 挂载到 DiagnosticEngine.prototype，供 engine.js 的 diagnose() 调用。
 */
(function (global) {
  'use strict';
  const R = global.RULES;
  const proto = global.DiagnosticEngine.prototype;

  // ---- 取值辅助 ----
  function ans(eng, key) { return eng._answers[key]; }
  function has(eng, key) { return eng._answers[key] === true; }
  // 主诉/跟进回答的文本片段匹配（对应原版 _selectedSymptoms.contains）
  // 注意：answerFollowUp 会把 followUp 的选项文本整体 push 进 _selectedSymptoms，
  // 其中「不痛/没汗/正常」等否定/中性选项若不排除，会因子串包含（如「不痛」含「痛」）
  // 造成 sel 误命中。这里跳过以否定/中性词开头的答案。
  // （「不能说话」虽以「不」开头但属阳性症状，不过其判定走 has(difficulty_speak)，
  //   且 sel 从不以「不能…」为子串匹配，故排除不影响结果。）
  function sel(eng, sub) {
    const list = eng._selectedSymptoms || [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s || !s.indexOf) continue;
      if (/^(没有|没|不|无|正常|还好)/.test(s)) continue;
      if (s.indexOf(sub) >= 0) return true;
    }
    return false;
  }
  function pulseIs(eng, arr) { return arr.indexOf(eng._pulseType) >= 0; }

  /* ===================== 太阳经 ===================== */
  proto._diagnoseTaiYang = function (a) {
    const eng = this;
    const hasSweat = ans(eng, 'has_sweat');
    const temp = ans(eng, 'temperature');
    const hasAbdomenPain = has(eng, 'abdomen_pain_press') || has(eng, 'abdomen_pain_relief') ||
      sel(eng, '腹痛') || sel(eng, '腹满');

    // 太阳误下转太阴系列
    const hasMistreat = has(eng, 'history_mistreatment') || sel(eng, '误下') || sel(eng, '被下');
    if (hasMistreat && hasAbdomenPain) {
      if (has(eng, 'abdomen_pain_press')) {
        return { meridian: '太阴', pattern: '太阳转太阴实痛（桂枝加大黄汤证）', patternDetail: '太阳病误下，腹满实痛，拒按。',
          formula: '桂枝加大黄汤', explanation: '桂枝汤调和营卫，重用芍药缓急止痛，加大黄泻下实邪。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      if (has(eng, 'abdomen_pain_relief')) {
        return { meridian: '太阴', pattern: '太阳转太阴时痛（桂枝加芍药汤证）', patternDetail: '太阳病误下，腹满时痛，喜按。',
          formula: '桂枝加芍药汤', explanation: '桂枝汤调和营卫，重用芍药缓急止痛。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
    }

    // 小青龙汤：表寒里寒，水饮咳喘
    const hasCoughAny = has(eng, 'cough') || (ans(eng, 'breathing') != null && ans(eng, 'breathing') !== '没有' && ans(eng, 'breathing') !== '没有此症状');
    const hasPhlegmCold = has(eng, 'phlegm_cold') || sel(eng, '痰白') || sel(eng, '清稀痰') || sel(eng, '心下有水气');
    if (hasSweat === false && hasCoughAny && hasPhlegmCold) {
      return { meridian: '太阳', pattern: '表寒里寒水饮（小青龙汤证）', patternDetail: '伤寒表不解，心下有水气，干呕发热而咳。',
        formula: '小青龙汤', explanation: '麻黄桂枝解表，干姜细辛温肺化饮，半夏燥湿，五味子敛肺，芍药甘草调和。表寒里饮双解。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }

    // 桂枝甘草汤：发汗过多心阳虚
    const hasPalpitations = has(eng, 'palpitation') || sel(eng, '心悸') || sel(eng, '叉手自冒心') || sel(eng, '心下悸');
    if (hasPalpitations && hasSweat === true && eng._pulseType != null && pulseIs(eng, ['虚', '大', '缓'])) {
      return { meridian: '太阳', pattern: '发汗过多心阳虚（桂枝甘草汤证）', patternDetail: '发汗过多，其人叉手自冒心，心下悸，欲得按。',
        formula: '桂枝甘草汤', explanation: '桂枝强心阳，炙甘草补中缓急。心阳受损，悸而喜按。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 桂枝加龙骨牡蛎汤：虚劳失精
    const hasDizziness = has(eng, 'headache_back') || sel(eng, '目眩') || sel(eng, '头晕');
    const hasHairLoss = sel(eng, '发落') || sel(eng, '脱发');
    const hasInsomniaOrDreams = has(eng, 'insomnia') || sel(eng, '多梦') || sel(eng, '失精');
    if (hasSweat === true && hasDizziness && (hasHairLoss || hasInsomniaOrDreams)) {
      return { meridian: '太阳', pattern: '虚劳失精（桂枝加龙骨牡蛎汤证）', patternDetail: '虚劳里急，悸衄腹中痛，梦失精，四肢酸疼，手足烦热，咽干口燥。',
        formula: '桂枝加龙骨牡蛎汤', explanation: '桂枝汤调和营卫，加龙骨牡蛎潜阳固精。虚劳失精主方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 桂枝去芍药汤：胸满
    const hasChestFullness = has(eng, 'chest_pain') || sel(eng, '胸满') || sel(eng, '胸闷');
    const hasNeckStiffness = has(eng, 'neck_stiff') || (ans(eng, 'neck') && ans(eng, 'neck').indexOf('僵硬') >= 0);
    if (hasSweat === true && hasChestFullness && !hasNeckStiffness && !hasCoughAny) {
      return { meridian: '太阳', pattern: '太阳胸满（桂枝去芍药汤证）', patternDetail: '太阳病误下后，脉促胸满。胸阳受损。',
        formula: '桂枝去芍药汤', explanation: '桂枝汤去芍药。芍药酸寒不利于胸阳宣通，去之以通胸阳。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    // 桂枝新加汤：发汗后身痛脉沉迟
    const hasBodyPainNew = has(eng, 'body_pain') || sel(eng, '身疼痛') || sel(eng, '全身酸痛');
    if (hasBodyPainNew && (eng._pulseType === '沉' || eng._pulseType === '迟')) {
      return { meridian: '太阳', pattern: '发汗后身痛（桂枝新加汤证）', patternDetail: '发汗后，身疼痛，脉沉迟。气营两伤。',
        formula: '新加汤', explanation: '桂枝汤加人参生姜芍药。发汗后气营不足，身痛脉沉迟。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    // 栝蒌桂枝汤：痉病兼津液不足
    const hasSpasm = sel(eng, '痉') || sel(eng, '抽搐') || (sel(eng, '项背强') && has(eng, 'thirsty'));
    if (hasSpasm && hasSweat === true) {
      return { meridian: '太阳', pattern: '痉病津亏（栝蒌桂枝汤证）', patternDetail: '太阳病，其证备，身体强，几几然，脉反沉迟。痉病兼津液不足。',
        formula: '栝蒌桂枝汤', explanation: '栝蒌根生津润燥，桂枝汤调和营卫。痉病津液不足者。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    // 桃核承气汤：膀胱蓄血轻证
    const hasLowerAbdomen = sel(eng, '少腹急结') || sel(eng, '小腹痛') || has(eng, 'lower_abdomen_pain');
    const hasManic = sel(eng, '如狂') || sel(eng, '发狂') || has(eng, 'irritable');
    if (hasLowerAbdomen && hasManic && hasSweat === false) {
      return { meridian: '太阳', pattern: '膀胱蓄血轻证（桃核承气汤证）', patternDetail: '太阳病不解，热结膀胱，其人如狂，少腹急结。',
        formula: '桃核承气汤', explanation: '桃仁活血化瘀，大黄泻下逐瘀，芒硝软坚，桂枝通经，甘草调和。蓄血轻证主方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 温病
    if (temp === 'fever_thirst_no_cold' || (has(eng, 'thirsty') && has(eng, 'cold_drink'))) {
      return { meridian: '太阳', pattern: '温病', patternDetail: '发热而渴，不恶寒者，为温病。津液不足。',
        formula: '桂枝加葛根汤/栝蒌桂枝汤', explanation: '温病津液不足，需生津液。张仲景治温病的处方一定加上很多生津液的药。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }

    if (hasSweat === true) {
      const hasNeck = has(eng, 'neck_stiff') || (ans(eng, 'neck') && ans(eng, 'neck').indexOf('僵硬') >= 0);
      if (hasNeck) {
        return { meridian: '太阳', pattern: '中风 + 项背强几几', patternDetail: '太阳病，项背强几几，汗出恶风',
          formula: '桂枝加葛根汤', explanation: '葛根把水提升上来，靠桂枝把水排出去变成汗。葛根升水到头面颈脖。', confidence: 0.95, matchedSymptoms: eng._selectedSymptoms };
      }
      if (hasCoughAny) {
        return { meridian: '太阳', pattern: '中风 + 咳喘', patternDetail: '桂枝汤证兼咳嗽气喘',
          formula: '桂枝加厚朴杏仁汤', explanation: '桂枝汤证兼有咳嗽气喘，加厚朴去脾湿、杏仁去肺热化痰。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '太阳', pattern: '中风（桂枝汤证）', patternDetail: '发热，汗出，恶风，脉缓。阳浮而阴弱。',
        formula: '桂枝汤', explanation: '桂枝壮心阳，白芍让静脉加速回流，生姜刺激肠胃蠕动，大枣补津液，炙甘草解百毒。', confidence: 0.95, matchedSymptoms: eng._selectedSymptoms };
    } else {
      if (has(eng, 'irritable')) {
        return { meridian: '太阳', pattern: '表寒里热（大青龙汤证）', patternDetail: '太阳伤寒，脉浮紧，不汗出而烦躁。',
          formula: '大青龙汤', explanation: '麻黄汤加石膏。表寒里热，外面怕冷里面烦躁。脉微弱者禁用。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '太阳', pattern: '伤寒（麻黄汤证）', patternDetail: '或已发热，或未发热，必恶寒，体痛，呕逆，脉阴阳俱紧。',
        formula: '麻黄汤', explanation: '无汗用麻黄。麻黄开毛孔，桂枝强心阳，杏仁降肺气，甘草调和。', confidence: 0.95, matchedSymptoms: eng._selectedSymptoms };
    }
  };

  /* ===================== 阳明经 ===================== */
  proto._diagnoseYangMing = function (a) {
    const eng = this;
    const constipated = ans(eng, 'constipated');
    const thirsty = ans(eng, 'thirsty');
    const abdomenPress = ans(eng, 'abdomen_pain_press');

    const hasEpigastric = sel(eng, '心下痞') || sel(eng, '胃脘痞满');
    if (hasEpigastric && abdomenPress !== true) {
      return { meridian: '阳明', pattern: '热痞（大黄黄连泻心汤证）', patternDetail: '心下痞，按之濡。热痞。',
        formula: '大黄黄连泻心汤', explanation: '大黄泻热，黄连清心胃之火。以麻沸汤渍之，取气不取味。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasRestlessness = sel(eng, '卧起不安') || (has(eng, 'irritable') && sel(eng, '腹满'));
    if (hasRestlessness) {
      return { meridian: '阳明', pattern: '心烦腹满（栀子厚朴枳实汤证）', patternDetail: '心烦腹满，卧起不安。',
        formula: '栀子厚朴枳实汤', explanation: '栀子清心除烦，厚朴行气消满，枳实破气消痞。心烦腹满两解。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasAlcoholJaundice = sel(eng, '酒黄疸') || sel(eng, '心中懊憹') || (sel(eng, '身黄') && sel(eng, '心中热'));
    if (hasAlcoholJaundice) {
      return { meridian: '阳明', pattern: '酒黄疸（栀子大黄汤证）', patternDetail: '心中懊憹而热，不能食，时欲吐。酒疸。',
        formula: '栀子大黄汤', explanation: '栀子清热利湿，大黄泻下除积，枳实行气，香豉宣郁。酒疸主方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasAbdomenDistension = sel(eng, '腹胀痛') || sel(eng, '腹满痛');
    if (hasAbdomenDistension && constipated === true && abdomenPress === true) {
      return { meridian: '阳明', pattern: '气滞腹满（厚朴三物汤证）', patternDetail: '痛而闭。腹胀痛，大便不通。偏于行气除满。',
        formula: '厚朴三物汤', explanation: '厚朴为主药行气消满，枳实破气，大黄泻下。与小承气汤药同量异。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasLegCramp = sel(eng, '脚挛急') || sel(eng, '腿抽筋') || sel(eng, '下肢拘挛');
    if (hasLegCramp) {
      return { meridian: '阳明', pattern: '筋脉拘急（芍药甘草汤证）', patternDetail: '脚挛急。筋脉拘急。',
        formula: '芍药甘草汤', explanation: '芍药柔肝缓急，甘草补中缓急。酸甘化阴，缓急止痛。又名去杖汤。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasPostSweatChills = sel(eng, '恶寒') && (sel(eng, '发汗后') || sel(eng, '汗后'));
    if (hasPostSweatChills) {
      return { meridian: '阳明', pattern: '发汗后虚寒（芍药甘草附子汤证）', patternDetail: '发汗后，病不解，反恶寒者。阴阳两虚。',
        formula: '芍药甘草附子汤', explanation: '附子温阳，芍药甘草养阴缓急。发汗后阴阳两虚恶寒者。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasMalaria = sel(eng, '温疟') || sel(eng, '骨节疼烦');
    if (hasMalaria) {
      return { meridian: '阳明', pattern: '温疟（白虎加桂枝汤证）', patternDetail: '身热，骨节疼烦，时呕。温疟。',
        formula: '白虎加桂枝汤', explanation: '白虎汤清热，桂枝解表通经。温疟身热骨节疼烦者。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasInsomnia = has(eng, 'insomnia');
    const hasUrinationProblem = has(eng, 'urine_difficult') || sel(eng, '小便不利');
    const hasFever = has(eng, 'fever') || sel(eng, '发热');
    if (hasInsomnia && hasUrinationProblem && hasFever) {
      return { meridian: '阳明', pattern: '阴虚水热互结（猪苓汤证）', patternDetail: '发热，心烦不得眠，小便不利。阴虚水热互结。',
        formula: '猪苓汤', explanation: '猪苓茯苓泽泻利水，阿胶滋阴，滑石清热。利水不伤阴，滋阴不碍湿。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasJaundice = has(eng, 'jaundice') || sel(eng, '身黄') || sel(eng, '黄疸') || sel(eng, '发黄');
    if (hasJaundice) {
      const hasBodyPain = has(eng, 'joint_pain') || sel(eng, '骨节疼烦') || sel(eng, '身痒');
      if (hasBodyPain) {
        return { meridian: '阳明', pattern: '阳明湿热发黄兼表证（麻黄连轺赤小豆汤证）', patternDetail: '身黄如橘子色，兼有表证。',
          formula: '麻黄连轺赤小豆汤', explanation: '麻黄解表，连轺赤小豆清热利湿，表里双解。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      const hasFever2 = has(eng, 'fever') || sel(eng, '发热');
      if (hasFever2) {
        return { meridian: '阳明', pattern: '阳明湿热发黄热重于湿（栀子柏皮汤证）', patternDetail: '身黄发热。热重于湿。',
          formula: '栀子柏皮汤', explanation: '栀子清热利湿，黄柏清热燥湿，甘草调和。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '阳明', pattern: '阳明湿热发黄（茵陈蒿汤证）', patternDetail: '身黄如橘子色，发热汗出。',
        formula: '茵陈蒿汤', explanation: '茵陈蒿清热利湿退黄，栀子清热，大黄泻下。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }

    if (constipated === true && (abdomenPress === true || sel(eng, '便秘好几天不通') || constipated === true)) {
      const severe = sel(eng, '便秘好几天不通') || (constipated === true && abdomenPress === true);
      const stomachPain = sel(eng, '只胃脘痛');
      const delirium = ans(eng, 'speech') === '有说胡话';
      const tidalFever = ans(eng, 'tidal_fever') === '下午3-5点发热（潮热）' || ans(eng, 'tidal_fever') === '手足汗出';

      if (severe && delirium && tidalFever) {
        return { meridian: '阳明', pattern: '腑实重证（大承气汤证）', patternDetail: '大便硬，腹满痛拒按，谵语，潮热。四证俱备。',
          formula: '大承气汤', explanation: '大黄芒硝攻下热结，厚朴枳实行气消满。急下存阴之峻剂。四证俱备方可峻攻。', confidence: 0.95, matchedSymptoms: eng._selectedSymptoms };
      }
      if (severe && delirium) {
        return { meridian: '阳明', pattern: '腑实证（大承气汤轻用）', patternDetail: '大便硬，谵语。热结已重但潮热未显。',
          formula: '大承气汤', explanation: '谵语为热上冲脑，虽无潮热但热结已重，可轻用大承气汤。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      if (stomachPain) {
        return { meridian: '阳明', pattern: '腑实轻证（调胃承气汤证）', patternDetail: '胃脘压痛，大便不通，心烦。',
          formula: '调胃承气汤', explanation: '大黄去实热，芒硝软坚，甘草缓和。腹诊下脘穴压痛。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '阳明', pattern: '腑实证（小承气汤证）', patternDetail: '腹胀谵语，大便硬。',
        formula: '小承气汤', explanation: '大黄攻下，厚朴行气，枳实消痞。腹诊关元穴压痛。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    if (thirsty === true && has(eng, 'cold_drink')) {
      return { meridian: '阳明', pattern: '经热证（白虎加人参汤证）', patternDetail: '身热，汗出，大渴，脉洪大。但热不寒。',
        formula: '白虎加人参汤', explanation: '石膏去肺热，知母除烦止渴生津，粳米保护肺泡，人参补气生津。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }

    return { meridian: '阳明', pattern: '阳明病', patternDetail: '但热不寒，身热汗出。阳明��死证。',
      formula: '白虎汤', explanation: '阳明病但热不寒。先辨是经热还是腑实，再选方。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
  };

  /* ===================== 少阳经 ===================== */
  proto._diagnoseShaoYang = function (a) {
    const eng = this;
    const hasConstipation = ans(eng, 'constipated');
    const hasChestRibFullness = has(eng, 'chest_pain') || sel(eng, '胸胁苦满');
    if (hasConstipation === true && hasChestRibFullness) {
      return { meridian: '少阳', pattern: '少阳阳明合病（大柴胡汤证）', patternDetail: '口苦咽干目眩，往来寒热，胸胁苦满，兼有便秘。',
        formula: '大柴胡汤', explanation: '小柴胡汤去人参甘草，加枳实芍药大黄。和解兼攻下。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }
    if (has(eng, 'irritable') || has(eng, 'drowsy')) {
      return { meridian: '少阳', pattern: '少阳病 + 虚烦（柴胡加龙骨牡蛎汤证）', patternDetail: '口苦咽干目眩，胸满惊烦，一身尽重。',
        formula: '柴胡加龙骨牡蛎汤', explanation: '柴胡和解少阳，龙骨牡蛎镇惊止烦，茯苓安神。虚人失眠很好用。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    const hasColdLimbs = has(eng, 'cold_limbs');
    const hasPulseStringy = eng._pulseType === '弦';
    if (hasColdLimbs && hasChestRibFullness && hasPulseStringy) {
      return { meridian: '少阳', pattern: '少阳气郁致厥（四逆散证）', patternDetail: '少阴病，四逆，其人或咳或悸或小便不利，或腹中痛。气郁致厥。',
        formula: '四逆散', explanation: '柴胡疏肝解郁，枳实破气消痞，芍药柔肝缓急，甘草调和。阳郁不达四末。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    return { meridian: '少阳', pattern: '少阳病（小柴胡汤证）', patternDetail: '口苦，咽干，目眩。往来寒热，胸胁苦满，心烦喜呕。',
      formula: '小柴胡汤', explanation: '柴胡和解少阳，黄芩清热，半夏止呕，人参补气。但见一证便是，不必悉具。', confidence: 0.95, matchedSymptoms: eng._selectedSymptoms };
  };

  /* ===================== 太阴经 ===================== */
  proto._diagnoseTaiYin = function (a) {
    const eng = this;
    const coldLimbs = ans(eng, 'cold_limbs');
    const hasEdema = has(eng, 'edema') || has(eng, 'joint_pain') || has(eng, 'joint_wandering');
    if (hasEdema) {
      return { meridian: '太阴', pattern: '风水/风湿（防己黄芪汤证）', patternDetail: '风水或风湿，汗出恶风，身重，小便不利。',
        formula: '防己黄芪汤', explanation: '防己利水，黄芪固表益气，白术健脾去湿。虚人风水专用方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    if (coldLimbs === true) {
      return { meridian: '太阴', pattern: '太阴虚寒（理中汤证）', patternDetail: '腹满而吐，食不下，自利益甚，手足不温。脾阳虚衰。',
        formula: '理中汤', explanation: '干姜温中散寒，人参补气健脾，白术燥湿，甘草调和。太阴虚寒主方。若寒重及肾（四肢厥冷过肘膝）则转少阴用四逆汤。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }
    const hasSpitting = sel(eng, '涎沫') || sel(eng, '吐涎沫');
    if (has(eng, 'irritable') && hasSpitting) {
      return { meridian: '太阴', pattern: '脾阳虚厥逆（甘草干姜汤证）', patternDetail: '四肢厥冷，烦躁，吐涎沫。脾阳不足。',
        formula: '甘草干姜汤', explanation: '干姜温脾阳，炙甘草补中缓急。回阳轻剂，厥逆回后以理中汤善后。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }
    const hasEmotionalCry = sel(eng, '脏躁') || sel(eng, '喜悲伤欲哭') || sel(eng, '精神恍惚');
    if (hasEmotionalCry) {
      return { meridian: '太阴', pattern: '妇人脏躁（甘麦大枣汤证）', patternDetail: '妇人脏躁，喜悲伤欲哭，象如神灵所作，数欠伸。',
        formula: '甘麦大枣汤', explanation: '甘草缓急，小麦养心，大枣补脾。甘润缓急，养心安神。脏躁专方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    const hasDiarrhea = has(eng, 'diarrhea');
    if (hasDiarrhea && has(eng, 'bitter_mouth')) {
      return { meridian: '太阴', pattern: '太阳少阳合病下利（黄芩汤证）', patternDetail: '太阳与少阳合病，自下利。腹痛，口苦。',
        formula: '黄芩汤', explanation: '黄芩清热止利，芍药敛阴缓急，甘草大枣和中。太少合病下利主方。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }
    if (sel(eng, '能吃但腹胀')) {
      return { meridian: '太阴', pattern: '脾虚气滞（厚朴生姜半夏甘草人参汤证）', patternDetail: '腹胀满者。脾虚气滞。',
        formula: '厚朴生姜半夏甘草人参汤', explanation: '厚朴行气消胀为主药，生姜半夏散水降逆，人参甘草补中。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    return { meridian: '太阴', pattern: '太阴病（理中汤证）', patternDetail: '腹满而吐，食不下，自利，腹痛。脾虚寒湿。',
      formula: '理中汤/理中丸', explanation: '人参补气，干姜温中，白术去湿，甘草调和。温中健脾。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
  };

  /* ===================== 少阴经 ===================== */
  proto._diagnoseShaoYin = function (a) {
    const eng = this;
    const hasHeat = ans(eng, 'irritable');
    const hasWaterRetention = has(eng, 'edema') || has(eng, 'urine_difficult');
    const bloodyStool = ans(eng, 'bloody_stool');
    const bodyPain = has(eng, 'joint_pain') || sel(eng, '骨节疼痛') || sel(eng, '全身酸痛');

    const hasIrritability = hasHeat === true;
    const hasInsomnia = has(eng, 'insomnia');
    const hasTongueRed = eng._tongueShape === '红' || eng._tongueShape === '绛紫';
    const hasThinCoating = eng._tongueCoating === '无苔' || eng._tongueCoating === '黄薄';
    const hasPulseThinFast = eng._pulseType === '细' || eng._pulseType === '数';
    if (hasIrritability && hasInsomnia && (hasTongueRed || hasPulseThinFast)) {
      return { meridian: '少阴', pattern: '少阴热化（黄连阿胶汤证）', patternDetail: '心中烦，不得卧。心肾不交。' + (hasTongueRed ? '舌红' : '') + (hasThinCoating ? '少苔' : '') + (hasPulseThinFast ? '脉细数' : ''),
        formula: '黄连阿胶汤', explanation: '黄连黄芩清心火，阿胶鸡子黄补心血，芍药敛阴。交通心肾。少阴热化专方。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }
    if (hasIrritability && hasInsomnia) {
      return { meridian: '少阴', pattern: '少阴虚热（栀子豉汤证）', patternDetail: '虚烦不得眠，心中懊憹。余热未尽。',
        formula: '栀子豉汤', explanation: '栀子清心除烦，香豉宣透郁热。虚烦失眠轻方。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasDaytimeIrritability = has(eng, 'irritable') && (sel(eng, '昼日烦躁') || sel(eng, '夜而安静'));
    if (hasDaytimeIrritability) {
      return { meridian: '少阴', pattern: '阳虚阴盛（干姜附子汤证）', patternDetail: '昼日烦躁不得眠，夜而安静。阳虚阴盛。',
        formula: '干姜附子汤', explanation: '干姜温中，生附子回阳。顿服，急救回阳。不呕不渴无表证者。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasSweatProfuse = sel(eng, '汗出不止') || sel(eng, '遂漏不止') || (has(eng, 'has_sweat') && ans(eng, 'drowsy') !== true);
    if (hasSweatProfuse && ans(eng, 'cold_limbs') !== true) {
      return { meridian: '少阴', pattern: '表阳不固（桂枝加附子汤证）', patternDetail: '太阳病，发汗，遂漏不止，其人恶风。表阳不固。',
        formula: '桂枝加附子汤', explanation: '桂枝汤调和营卫，炮附子温经固表。汗出不止恶风者。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasSevereCold = has(eng, 'cold_limbs') && (eng._pulseType === '微' || eng._pulseType === '细');
    if (hasIrritability && hasSevereCold) {
      return { meridian: '少阴', pattern: '阳虚烦躁（茯苓四逆汤证）', patternDetail: '发汗，若下之，病不解，烦躁。阳虚阴盛。',
        formula: '茯苓四逆汤', explanation: '茯苓安神，人参补气，附子回阳，干姜温中，甘草调和。阴阳双补。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    if (bloodyStool === true) {
      return { meridian: '少阴', pattern: '少阴虚寒下利（桃花汤证）', patternDetail: '少阴病，下利不止，便脓血。',
        formula: '桃花汤', explanation: '赤石脂涩肠止利，干姜温中，粳米护胃。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }

    if (hasWaterRetention === true) {
      return { meridian: '少阴', pattern: '少阴水饮（真武汤证）', patternDetail: '心下悸，头眩，身瞤动，小便不利。',
        formula: '真武汤', explanation: '附子壮肾阳，茯苓利水，白术健脾，芍药止痛，生姜散水。阳虚水泛。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }
    if (hasWaterRetention === true && eng._pulseType === '沉' && ans(eng, 'palpitation') !== true && ans(eng, 'dizziness') !== true) {
      return { meridian: '少阴', pattern: '少阴水肿（麻黄附子汤证）', patternDetail: '水之为病，其脉沉小，属少阴。',
        formula: '麻黄附子汤', explanation: '麻黄发汗利水，附子温经。少阴水肿。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasSoreThroat = has(eng, 'sore_throat') || sel(eng, '咽痛') || sel(eng, '喉咙痛');
    const hasThroatUlcer = has(eng, 'throat_ulcer') || sel(eng, '咽中伤') || sel(eng, '生疮');
    const hasDifficultySpeak = has(eng, 'difficulty_speak') || sel(eng, '不能语言');
    if (hasSoreThroat || hasThroatUlcer) {
      if (hasThroatUlcer && hasDifficultySpeak) {
        return { meridian: '少阴', pattern: '少阴痰热咽痛（苦酒汤证）', patternDetail: '咽中伤，生疮，不能语言，声不出。',
          formula: '苦酒汤', explanation: '半夏化痰散结，鸡子清润喉，苦酒散瘀消肿。含咽法使药力直达病所。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      const hasPus = has(eng, 'throat_pus') || sel(eng, '化脓') || sel(eng, '脓');
      if (hasPus) {
        return { meridian: '少阴', pattern: '少阴咽痛化脓（桔梗汤证）', patternDetail: '咽痛，化脓。',
          formula: '桔梗汤', explanation: '桔梗开提肺气，化痰排脓，配甘草清热解毒。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      const hasChills = has(eng, 'chills') || has(eng, 'cold_limbs');
      const hasHeatSigns = has(eng, 'thirst_strong') || eng._tongueCoating === '黄';
      if (hasChills && !hasHeatSigns) {
        return { meridian: '少阴', pattern: '少阴客寒咽痛（半夏散及汤证）', patternDetail: '咽中痛，畏寒，无热象。',
          formula: '半夏散及汤', explanation: '半夏散寒化痰，桂枝通阳散寒，甘草缓急止痛。寒邪客于少阴经脉。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      const hasDiarrhea = has(eng, 'diarrhea');
      const hasChestFullness = has(eng, 'chest_fullness') || sel(eng, '胸满');
      if (hasDiarrhea && hasChestFullness) {
        return { meridian: '少阴', pattern: '少阴虚火咽痛（猪肤汤证）', patternDetail: '下利咽痛，胸满心烦。',
          formula: '猪肤汤', explanation: '猪肤滋阴润燥，白蜜润肺，白粉益气和中。甘润平和，最宜虚火咽痛。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '少阴', pattern: '少阴咽痛（甘草汤证）', patternDetail: '少阴病，咽痛。',
        formula: '甘草汤', explanation: '生甘草清热解毒，缓急止痛。为咽痛基础方，不差者用桔梗汤。', confidence: 0.75, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasSevereJointPain = sel(eng, '历节') || sel(eng, '关节剧痛') || sel(eng, '不可屈伸');
    if (hasSevereJointPain) {
      return { meridian: '少阴', pattern: '寒湿历节（乌头汤证）', patternDetail: '病历节，不可屈伸，疼痛。寒湿痹阻。',
        formula: '乌头汤', explanation: '乌头散寒止痛，麻黄发汗散寒，芍药甘草缓急。寒湿历节剧痛者。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    const hasHerniaPain = sel(eng, '寒疝') || sel(eng, '绕脐痛');
    if (hasHerniaPain) {
      return { meridian: '少阴', pattern: '寒疝腹痛（乌头煎证）', patternDetail: '腹痛，绕脐痛，发则白汗出，手足厥冷。',
        formula: '乌头煎', explanation: '乌头大热散寒止痛，蜜制缓毒。寒疝剧痛专方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const painAnswer = ans(eng, 'pain');
    const hasBodyPainFromAnswer = painAnswer != null && (painAnswer.indexOf('全身酸痛') >= 0 || painAnswer.indexOf('骨节疼痛') >= 0 || painAnswer.indexOf('关节') >= 0);
    if (bodyPain === true || hasBodyPainFromAnswer) {
      return { meridian: '少阴', pattern: '少阴经脉寒湿（附子汤证）', patternDetail: '身体痛，手足寒，骨节痛，脉沉。',
        formula: '附子汤', explanation: '附子温经散寒，茯苓利水，人参补气，白术健脾，芍药止痛。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasMildCold = sel(eng, '少阴表证') || (sel(eng, '无汗') && has(eng, 'drowsy'));
    if (hasMildCold && ans(eng, 'diarrhea') !== true) {
      return { meridian: '少阴', pattern: '少阴表证缓和（麻黄附子甘草汤证）', patternDetail: '少阴病，得之二三日，无里证。微发汗。',
        formula: '麻黄附子甘草汤', explanation: '麻黄发汗，附子温经，甘草调和。少阴兼表轻证，微发其汗。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasDiarrhea2 = has(eng, 'diarrhea');
    if (hasDiarrhea2) {
      const hasNoPulse = eng._pulseType === '微' || eng._pulseType === '绝' || eng._pulseType === '无';
      if (hasNoPulse) {
        return { meridian: '少阴', pattern: '少阴阴盛格阳（白通加猪胆汁汤证）', patternDetail: '下利不止，脉绝。阴盛格阳。',
          formula: '白通加猪胆汁汤', explanation: '白通汤破阴通阳，加人尿猪胆汁咸寒反佐，引阳药入阴。热因寒用。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '少阴', pattern: '少阴下利（白通汤证）', patternDetail: '少阴病下利。阴寒内盛。',
        formula: '白通汤', explanation: '葱白通阳，干姜温中，附子回阳。三药合用，通阳破阴。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasLoinPain = sel(eng, '腰痛') || sel(eng, '腰酸') || has(eng, 'back_pain');
    const hasColdFeet = sel(eng, '脚冷') || sel(eng, '足冷');
    if (hasLoinPain && hasColdFeet) {
      return { meridian: '少阴', pattern: '肾阳虚腰痛（肾气丸证）', patternDetail: '虚劳腰痛，少腹拘急，小便不利。肾阳不足。',
        formula: '肾气丸', explanation: '六味地黄丸加桂枝附子。少火生气，温补肾阳。虚劳腰痛专方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    return { meridian: '少阴', pattern: '少阴寒化（四逆汤证）', patternDetail: '脉微细，但欲寐，四肢厥冷。心肾阳虚。',
      formula: '四逆汤', explanation: '生附子壮肾阳回阳救逆，干姜温中，炙甘草补中缓急。少阴病急温之。', confidence: 0.95, matchedSymptoms: eng._selectedSymptoms };
  };

  /* ===================== 厥阴经 ===================== */
  proto._diagnoseJueYin = function (a) {
    const eng = this;
    const hasColdLimbs = ans(eng, 'cold_limbs');

    let coldCount = 0, heatCount = 0;
    if (hasColdLimbs === true) coldCount++;
    if (has(eng, 'upper_heat_lower_cold')) { coldCount++; heatCount++; }
    if (has(eng, 'thirst_strong')) heatCount++;
    if (has(eng, 'xiaoke')) heatCount++;
    if (has(eng, 'irritable')) heatCount++;
    if (has(eng, 'diarrhea')) coldCount++;

    let jueRe = null;
    if (coldCount > heatCount) jueRe = '厥多热少→病进，阳气渐衰，预后差';
    else if (heatCount > coldCount) jueRe = '热多厥少→病退，阳气来复，预后好';
    else if (coldCount > 0 && heatCount > 0) jueRe = '厥热相等→病稳，正邪相持';

    let liverRx = '';
    if (has(eng, 'menstrual_pain') || has(eng, 'joint_wandering') || has(eng, 'lower_abdomen_pain')) {
      liverRx = '\n治肝三法：补用酸（乌梅丸）、助用焦苦（吴茱萸汤）、益用甘味（小建中汤）';
    }

    if (has(eng, 'vomiting') && has(eng, 'thirst_strong') && hasColdLimbs === true) {
      return { meridian: '厥阴', pattern: '厥阴寒格（干姜黄芩黄连人参汤证）', patternDetail: '寒格于内，食入口即吐。上热下寒。',
        formula: '干姜黄芩黄连人参汤', explanation: '黄芩黄连清上热，干姜温下寒，人参补中。寒热格拒，开上热降逆，温下寒复阳。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    const hasBloodySputum = has(eng, 'bloody_sputum') || sel(eng, '唾脓血') || sel(eng, '咳血');
    const hasSevereDiarrhea = has(eng, 'diarrhea') && (has(eng, 'severe_diarrhea') || sel(eng, '泄利不止'));
    if (hasBloodySputum && hasSevereDiarrhea && hasColdLimbs === true) {
      return { meridian: '厥阴', pattern: '厥阴寒热错杂重证（麻黄升麻汤证）', patternDetail: '手足厥逆，唾脓血，泄利不止。上热下寒，寒热错杂。',
        formula: '麻黄升麻汤', explanation: '麻黄升麻发越郁阳，芩石膏清上热，姜术温下寒，归芍天冬葳蕤养阴血。寒热并用，表里兼顾。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    if (has(eng, 'vomiting') && has(eng, 'headache_back')) {
      return { meridian: '厥阴', pattern: '厥阴寒逆（吴茱萸汤证）', patternDetail: '干呕吐涎沫，头痛。肝寒犯胃，浊阴上逆。',
        formula: '吴茱萸汤', explanation: '吴茱萸温肝降逆，生姜散寒止呕，人参大枣补中。厥阴经寒上逆之主方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    if (hasColdLimbs === true) {
      const hasChronicCold = sel(eng, '内有久寒') || sel(eng, '腹冷痛') || sel(eng, '久寒');
      if (hasChronicCold) {
        return { meridian: '厥阴', pattern: '厥阴久寒（当归四逆加吴茱萸生姜汤证）', patternDetail: '手足厥寒，脉细欲绝，内有久寒。血虚寒凝，久寒在里。',
          formula: '当归四逆加吴茱萸生姜汤', explanation: '当归四逆汤温经散寒，加吴茱萸生姜温里散寒。厥阴久寒重证。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '厥阴', pattern: '厥阴寒凝（当归四逆汤证）', patternDetail: '手足厥寒，脉细欲绝。血虚寒凝。' + (jueRe ? '\n' + jueRe : ''),
        formula: '当归四逆汤', explanation: '当归补血，桂枝细辛温经散寒，通草通血脉。' + liverRx, confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }

    return { meridian: '厥阴', pattern: '厥阴病（乌梅丸证）', patternDetail: '消渴，气上撞心，心中疼热，饥而不欲食。上热下寒。' + (jueRe ? '\n' + jueRe : ''),
      formula: '乌梅丸', explanation: '乌梅酸收敛，细辛干姜温里，黄连黄柏清上热，附子桂枝温下寒。寒热并用。' + liverRx, confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
  };

  /* ===================== 杂病 / 跨经 ===================== */
  proto._diagnoseMiscellaneous = function (a) {
    const eng = this;
    const hasUrinationProblem = has(eng, 'urine_difficult') || sel(eng, '小便不利');
    const thirsty = has(eng, 'thirsty');

    // 五苓散：膀胱蓄水
    const hasWaterVomit = sel(eng, '水入即吐') || sel(eng, '渴而饮水不止');
    if (thirsty && hasUrinationProblem && hasWaterVomit) {
      return { meridian: '太阳', pattern: '膀胱蓄水（五苓散证）', patternDetail: '脉浮，小便不利，微热消渴。水蓄膀胱。',
        formula: '五苓散', explanation: '猪苓泽泻利水，茯苓白术健脾，桂枝化气利水。表里双解，化气行水。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 半夏泻心汤：寒热痞
    const hasEpigastric = sel(eng, '心下痞') || sel(eng, '胃脘痞满') || sel(eng, '痞硬');
    const hasBorborygmus = sel(eng, '肠鸣') || sel(eng, '腹中雷鸣');
    if (hasEpigastric && (has(eng, 'vomiting') || hasBorborygmus)) {
      return { meridian: '少阳', pattern: '寒热痞（半夏泻心汤证）', patternDetail: '呕而发热，心下痞硬。寒热错杂之痞。',
        formula: '半夏泻心汤', explanation: '半夏干姜辛温开痞，黄芩黄连苦寒清热，人参甘草大枣补中。辛开苦降。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    // 生姜泻心汤
    const hasFoodStink = sel(eng, '食臭') || sel(eng, '噫气食臭');
    if (hasEpigastric && hasBorborygmus && hasFoodStink) {
      return { meridian: '少阳', pattern: '水饮食滞痞（生姜泻心汤证）', patternDetail: '心下痞硬，干噫食臭，腹中雷鸣下利。',
        formula: '生姜泻心汤', explanation: '半夏泻心汤加生姜，重用生姜散水消痞。水饮食滞痞专方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    // 甘草泻心汤
    const hasSevereDiarrhea = sel(eng, '下利不止') || sel(eng, '日数十行');
    if (hasEpigastric && hasSevereDiarrhea) {
      return { meridian: '少阳', pattern: '痞利俱甚（甘草泻心汤证）', patternDetail: '心下痞硬而满，下利日数十行，干呕心烦。',
        formula: '甘草泻心汤', explanation: '半夏泻心汤重用甘草。缓急和中，止利止呕。狐惑病亦用此方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 大陷胸汤 / 小陷胸汤
    const hasChestPain = sel(eng, '结胸') || sel(eng, '心下满痛') || sel(eng, '从心下至少腹');
    if (hasChestPain && ans(eng, 'constipated') === true) {
      return { meridian: '太阳', pattern: '水热互结结胸（大陷胸汤证）', patternDetail: '心下满而硬痛，便秘，短气烦躁。结胸重证。',
        formula: '大陷胸汤', explanation: '大黄芒硝泻热，甘遂逐水。结胸重证峻下逐水。非结胸不可用。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }
    if (hasChestPain && (eng._pulseType === '浮' || eng._pulseType === '滑')) {
      return { meridian: '太阳', pattern: '痰热结胸（小陷胸汤证）', patternDetail: '小结胸病，正在心下，按之则痛，脉浮滑。',
        formula: '小陷胸汤', explanation: '黄连清热，半夏化痰，栝蒌宽胸散结。痰热互结之小结胸。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    // 旋覆代赭石汤：胃虚痰阻噫气
    const hasBelching = sel(eng, '噫气') || sel(eng, '嗳气') || sel(eng, '打嗝');
    if (hasEpigastric && hasBelching) {
      return { meridian: '阳明', pattern: '胃虚痰阻（旋覆代赭石汤证）', patternDetail: '心下痞硬，噫气不除。胃虚痰阻，气逆不降。',
        formula: '旋覆代赭石汤', explanation: '旋覆花降气消痰，代赭石重镇降逆，半夏生姜化痰和胃。噫气不除专方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 胸痹系列
    const hasChestBi = sel(eng, '胸痹') || sel(eng, '胸背痛') || sel(eng, '喘息咳唾');
    if (hasChestBi) {
      const hasShortnessBreath = sel(eng, '短气') || sel(eng, '不得卧');
      if (hasShortnessBreath) {
        return { meridian: '太阳', pattern: '胸痹重证（栝蒌薤白半夏汤证）', patternDetail: '胸痹不得卧，心痛彻背。痰浊壅盛。',
          formula: '栝蒌薤白半夏汤', explanation: '栝蒌宽胸散结，薤白通阳散结，半夏化痰。胸痹重证。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      const hasRetrosternal = sel(eng, '胁下逆抢心') || sel(eng, '气从胁下冲心');
      if (hasRetrosternal) {
        return { meridian: '太阳', pattern: '胸痹气滞（枳实薤白桂枝汤证）', patternDetail: '胸痹，心中痞气，气结在胸，胁下逆抢心。',
          formula: '枳实薤白桂枝汤', explanation: '栝蒌薤白通阳散结，枳实行气消痞，厚朴下气除满。胸痹气滞专方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '太阳', pattern: '胸痹（栝蒌薤白白酒汤证）', patternDetail: '胸痹之病，喘息咳唾，胸背痛，短气。',
        formula: '栝蒌薤白白酒汤', explanation: '栝蒌宽胸散结，薤白通阳散结，白酒行气活血。胸痹基础方。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    // 抵当汤：蓄血重证
    const hasHardAbdomen = sel(eng, '少腹硬满') || sel(eng, '少腹坚硬');
    const hasManic = sel(eng, '发狂') || sel(eng, '如狂');
    if (hasHardAbdomen && hasManic) {
      return { meridian: '太阳', pattern: '蓄血重证（抵当汤证）', patternDetail: '太阳病不解，热结膀胱，其人如狂，少腹硬满。蓄血重证。',
        formula: '抵当汤', explanation: '水蛭虻虫破血逐瘀，桃仁大黄活血泻下。蓄血重证峻攻。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 白头翁汤：热利下重
    const hasDysentery = sel(eng, '热利') || sel(eng, '里急后重') || sel(eng, '下重');
    if (hasDysentery) {
      return { meridian: '厥阴', pattern: '热利下重（白头翁汤证）', patternDetail: '热利下重，腹痛，便脓血。肝经湿热下迫大肠。',
        formula: '白头翁汤', explanation: '白头翁清热凉血，黄连黄柏清热燥湿，秦皮清热止利。热利主方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 大黄附子汤：寒积
    const hasSevereAbdomenPain = sel(eng, '腹痛剧烈') || sel(eng, '胁下偏痛');
    if (hasSevereAbdomenPain && ans(eng, 'constipated') === true && ans(eng, 'cold_limbs') === true) {
      return { meridian: '少阴', pattern: '寒积腹痛（大黄附子汤证）', patternDetail: '胁下偏痛，发热，脉紧弦。寒积内实。',
        formula: '大黄附子汤', explanation: '大黄泻下，附子细辛温里散寒。寒积腹痛专方，温下并用。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 温经汤：妇人月经病
    const hasGynecology = sel(eng, '月经不调') || sel(eng, '久不受孕') || sel(eng, '宫寒');
    if (hasGynecology) {
      return { meridian: '厥阴', pattern: '妇人月经病（温经汤证）', patternDetail: '妇人年五十所，病下利数十日不止，暮即发热。冲任虚寒。',
        formula: '温经汤', explanation: '吴茱萸桂枝温经散寒，当归川芎养血，人参阿胶补虚。温经养血调经。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    // 当归芍药散：妊娠腹痛
    if ((sel(eng, '妊娠') || sel(eng, '怀孕')) && sel(eng, '腹中㽲痛')) {
      return { meridian: '太阴', pattern: '妊娠腹痛（当归芍药散证）', patternDetail: '妇人怀妊，腹中㽲痛。肝脾不调。',
        formula: '当归芍药散', explanation: '当归芍药养血柔肝，川芎活血，茯苓白术泽泻健脾利水。妊娠腹痛专方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 葛根汤：太阳阳明合病
    if (sel(eng, '项背强') && ans(eng, 'has_sweat') !== true) {
      return { meridian: '太阳', pattern: '太阳阳明合病（葛根汤证）', patternDetail: '太阳病，项背强几几，无汗恶风。',
        formula: '葛根汤', explanation: '葛根升津舒经，麻黄桂枝解表，芍药甘草缓急。太阳阳明合病主方。', confidence: 0.9, matchedSymptoms: eng._selectedSymptoms };
    }
    if (sel(eng, '项背强') && has(eng, 'vomiting')) {
      return { meridian: '太阳', pattern: '太阳阳明合病呕（葛根加半夏汤证）', patternDetail: '太阳阳明合病，不下利但呕者。',
        formula: '葛根加半夏汤', explanation: '葛根汤解表，半夏降逆止呕。太阳阳明合病呕者。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 葛根黄芩黄连汤：热利
    if (has(eng, 'diarrhea') && has(eng, 'fever') && eng._pulseType === '促') {
      return { meridian: '阳明', pattern: '热利不止（葛根黄芩黄连汤证）', patternDetail: '太阳病，桂枝证，医反下之，利遂不止，脉促者。',
        formula: '葛根黄芩黄连汤', explanation: '葛根升津止利，黄芩黄连清热燥湿，甘草调和。表里双解之热利方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 苓桂术甘汤
    if (sel(eng, '气上冲胸') || sel(eng, '起则头眩')) {
      return { meridian: '太阳', pattern: '痰饮中焦（苓桂术甘汤证）', patternDetail: '心下逆满，气上冲胸，起则头眩，脉沉紧。',
        formula: '苓桂术甘汤', explanation: '茯苓利水，桂枝通阳，白术健脾，甘草调和。痰饮主方。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 麻子仁丸：脾约
    if (ans(eng, 'constipated') === true && sel(eng, '小便数')) {
      return { meridian: '阳明', pattern: '脾约（麻子仁丸证）', patternDetail: '趺阳脉浮而涩，浮则胃气强，涩则小便数，大便则硬。',
        formula: '麻子仁丸', explanation: '麻子仁润肠，大黄泻下，枳实厚朴行气，芍药养阴，杏仁润燥。脾约便秘。', confidence: 0.85, matchedSymptoms: eng._selectedSymptoms };
    }

    // 栀子豉变方：心中懊憹
    if (sel(eng, '心中懊憹') || sel(eng, '反复颠倒')) {
      if (has(eng, 'vomiting')) {
        return { meridian: '阳明', pattern: '虚烦兼呕（栀子生姜豉汤证）', patternDetail: '虚烦不得眠，心中懊憹，兼呕。',
          formula: '栀子生姜豉汤', explanation: '栀子清热除烦，生姜止呕，香豉宣郁。虚烦兼呕。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
      }
      return { meridian: '阳明', pattern: '虚烦懊憹（栀子甘草豉汤证）', patternDetail: '虚烦不得眠，心中懊憹，兼少气。',
        formula: '栀子甘草豉汤', explanation: '栀子清热除烦，甘草益气，香豉宣郁。虚烦兼少气。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    // 厚朴七物汤：腹满发热脉浮
    if (sel(eng, '腹满') && has(eng, 'fever') && eng._pulseType === '浮') {
      return { meridian: '阳明', pattern: '表里双解（厚朴七物汤证）', patternDetail: '病腹满，发热十日，脉浮而数，饮食如故。',
        formula: '厚朴七物汤', explanation: '厚朴三物汤攻里，桂枝汤解表。表里双解之腹满方。', confidence: 0.8, matchedSymptoms: eng._selectedSymptoms };
    }

    return null;
  };

  /* ===================== 处方构建 ===================== */
  proto._resolveFormula = function (name) {
    if (!this._formulas || !this._formulas.length || !name) return null;
    let f = this._formulas.find((x) => x.name === name);
    if (f) return f;
    f = this._formulas.find((x) => x.alias && name.indexOf(x.alias) >= 0);
    if (f) return f;
    if (name.indexOf('/') >= 0) {
      const first = name.split('/')[0].trim();
      const found = this._resolveFormula(first);
      if (found) return found;
    }
    f = this._formulas.find((x) => name.indexOf(x.name) >= 0 && x.name.length >= 2);
    if (f) return f;
    f = this._formulas.find((x) => x.name.indexOf(name) >= 0 && name.length >= 2);
    if (f) return f;
    return null;
  };

  proto.buildPrescription = function (formulaName, opts) {
    opts = opts || {};
    const mods = opts.modifications || null;
    const formula = this._resolveFormula(formulaName);
    if (!formula) return null;
    const components = (formula.components || []).map((c) => ({
      name: c.name,
      dosage: c.dosage || '',
      role: c.role || '',
    }));
    return {
      formulaName: formula.name,
      alias: formula.alias || '',
      meridian: formula.meridian,
      category: formula.category,
      components: components,
      preparation: formula.dosage || '',
      indication: formula.indication || '',
      contraindication: formula.contraindication || '',
      explanation: formula.explanation || '',
      keywords: formula.keywords || [],
      modifications: mods,
    };
  };
})(window);
