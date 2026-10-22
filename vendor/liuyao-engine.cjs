/** MIT 六爻领域引擎：从上游独立计算部分提取，保留原注释与许可证。
 * Source: https://github.com/gundamdarke398-ship-it/liuyao-divination
 * Copyright (c) 2025 Oriental Grove / Zhen Ming (贞明)
 * Source SHA256: 364323efca8e5829e1c7ad25dbdabcab03d23dee8d0a69b81d691c7e14458056
 */

// ============================================================================
// 以下为 liuyao_engine.js 的完整内容
// ============================================================================

/**
 * ============================================================================
 * 六爻排盘核心引擎 (liuyao_engine.js)
 * ============================================================================
 *
 * 本文件实现了六爻排盘的全部核心功能，包括：
 *   1. 八宫六十四卦数据库
 *   2. 纳甲装卦（按实际内外卦象分别纳甲）
 *   3. 六亲配卦（根据宫五行）
 *   4. 六神配卦（根据日干）
 *   5. 天干地支转换（空亡、六合、六冲、三合、三刑、生旺墓绝）
 *   6. 月建旺衰计算
 *   7. 伏神检测（缺爻检测）
 *   8. 六合卦/六冲卦检测
 *   9. 主排盘函数 mainCast(input)
 *
 * 所有数据均依据传统六爻理论，力求准确无误。
 *
 * 关于八宫五行：
 *   传统八宫五行为 乾金、坎水、艮土、震木、巽木、离火、坤土、兑金。
 *   （注：用户描述中"金水木木木火土金"将艮宫列为木，但传统六爻中艮宫
 *   五行确为土，六亲推算以此为准。本代码采用传统正确映射。）
 *
 * 关于六合卦/六冲卦：
 *   本代码采用动态计算方式——根据纳甲后各爻地支，判断初四、二五、三上
 *   三对爻是否全部六合（六合卦）或全部六冲（六冲卦）。此为传统标准方法。
 *   动态计算结果：
 *   - 六冲卦(10)：乾为天、坎为水、艮为山、震为雷、巽为风、离为火、
 *     坤为地、兑为泽（八纯卦）、雷天大壮、天雷无妄
 *   - 六合卦(8)：水泽节、地雷复、地天泰、山火贲、天地否、雷地豫、
 *     泽水困、火山旅
 *
 * 用法示例：
 *   const engine = require('./liuyao_engine');
 *   const result = engine.mainCast({
 *     mainHexagram: '天水讼',
 *     changedHexagram: [3],           // 三爻动
 *     yearPillar: '丙午',
 *     monthPillar: '乙未',
 *     dayPillar: '甲子',
 *     hourPillar: '戊辰'
 *   });
 * ============================================================================
 */

'use strict';

// ============================================================================
// 第一部分：基础常量定义
// ============================================================================

/** 天干（甲乙丙丁戊己庚辛壬癸） */
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 地支（子丑寅卯辰巳午未申酉戌亥） */
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 地支五行映射 */
const ZHI_WU_XING = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
  '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水'
};

/** 天干五行映射 */
const GAN_WU_XING = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
  '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
};

/** 五行相生：金生水、水生木、木生火、火生土、土生金 */
const SHENG = { '金': '水', '水': '木', '木': '火', '火': '土', '土': '金' };

/** 五行相克：金克木、木克土、土克水、水克火、火克金 */
const KE = { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' };

/** 六合：子丑合、寅亥合、卯戌合、辰酉合、巳申合、午未合 */
const LIU_HE_MAP = {
  '子': '丑', '丑': '子', '寅': '亥', '亥': '寅', '卯': '戌', '戌': '卯',
  '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午'
};

/** 六冲：子午冲、丑未冲、寅申冲、卯酉冲、辰戌冲、巳亥冲 */
const LIU_CHONG_MAP = {
  '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅',
  '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'
};

/**
 * 相刑关系（双向）
 * 寅巳申三刑（无恩之刑）、子卯相刑（无礼之刑）、
 * 丑戌未三刑（恃势之刑）、辰午酉亥自刑
 */
const XING_MAP = {
  '寅': ['巳', '申'], '巳': ['寅', '申'], '申': ['寅', '巳'],
  '子': ['卯'], '卯': ['子'],
  '丑': ['戌', '未'], '戌': ['丑', '未'], '未': ['丑', '戌'],
  '辰': ['辰'], '午': ['午'], '酉': ['酉'], '亥': ['亥']
};

/** 六神名称（依次为青龙、朱雀、勾陈、螣蛇、白虎、玄武） */
const LIU_SHEN_NAMES = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];

/** 六亲名称 */
const LIU_QIN_NAMES = ['父母', '兄弟', '子孙', '妻财', '官鬼'];

/** 八宫五行（传统正确映射） */
const GONG_WU_XING = {
  '乾': '金', '坎': '水', '艮': '土', '震': '木',
  '巽': '木', '离': '火', '坤': '土', '兑': '金'
};

/**
 * 八卦（经卦）阴阳定义
 * [初爻, 中爻, 上爻]（true=阳爻，false=阴爻）
 * 乾☰ 兑☱ 离☲ 震☳ 巽☴ 坎☵ 艮☶ 坤☷
 */
const BA_GUA = {
  '乾': [true, true, true],
  '兑': [true, true, false],
  '离': [true, false, true],
  '震': [true, false, false],
  '巽': [false, true, true],
  '坎': [false, true, false],
  '艮': [false, false, true],
  '坤': [false, false, false]
};

/** 反向映射：从阴阳数组获取经卦名 */
const BA_GUA_REVERSE = {};
for (const [name, lines] of Object.entries(BA_GUA)) {
  BA_GUA_REVERSE[lines.join(',')] = name;
}

/**
 * 纳甲表
 * 各经卦的内卦和外卦天干地支
 * 地支从初爻到三爻（内卦）/ 四爻到六爻（外卦）排列
 *
 * 纳甲规则（天干）：
 *   乾内甲外壬、坤内乙外癸、震内庚外庚、巽内辛外辛、
 *   坎内戊外戊、离内己外己、艮内丙外丙、兑内丁外丁
 *
 * 纳甲规则（地支，阳顺阴逆）：
 *   乾：内子寅辰（阳顺）、外午申戌（阳顺）
 *   坤：内未巳卯（阴逆）、外丑亥酉（阴逆）
 *   震：内子寅辰（阳顺）、外午申戌（阳顺）
 *   巽：内丑亥酉（阴逆）、外未巳卯（阴逆）
 *   坎：内寅辰午（阳顺）、外申戌子（阳顺）
 *   离：内卯丑亥（阴逆）、外酉未巳（阴逆）
 *   艮：内辰午申（阳顺）、外戌子寅（阳顺）
 *   兑：内巳卯丑（阴逆）、外亥酉未（阴逆）
 */
const NA_JIA_TABLE = {
  '乾': { innerGan: '甲', innerZhi: ['子', '寅', '辰'], outerGan: '壬', outerZhi: ['午', '申', '戌'] },
  '坤': { innerGan: '乙', innerZhi: ['未', '巳', '卯'], outerGan: '癸', outerZhi: ['丑', '亥', '酉'] },
  '震': { innerGan: '庚', innerZhi: ['子', '寅', '辰'], outerGan: '庚', outerZhi: ['午', '申', '戌'] },
  '巽': { innerGan: '辛', innerZhi: ['丑', '亥', '酉'], outerGan: '辛', outerZhi: ['未', '巳', '卯'] },
  '坎': { innerGan: '戊', innerZhi: ['寅', '辰', '午'], outerGan: '戊', outerZhi: ['申', '戌', '子'] },
  '离': { innerGan: '己', innerZhi: ['卯', '丑', '亥'], outerGan: '己', outerZhi: ['酉', '未', '巳'] },
  '艮': { innerGan: '丙', innerZhi: ['辰', '午', '申'], outerGan: '丙', outerZhi: ['戌', '子', '寅'] },
  '兑': { innerGan: '丁', innerZhi: ['巳', '卯', '丑'], outerGan: '丁', outerZhi: ['亥', '酉', '未'] }
};

/** 长生十二宫名称 */
const SHI_ER_GONG_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];

/**
 * 各五行长生起始地支
 * 金长生巳、木长生亥、水（土同水）长生申、火长生寅
 */
const CHANG_SHENG_START = {
  '金': '巳', '木': '亥', '水': '申', '火': '寅', '土': '申'
};

/** 三合局定义 */
const SAN_HE_GROUPS = [
  { branches: ['申', '子', '辰'], element: '水' },
  { branches: ['巳', '酉', '丑'], element: '金' },
  { branches: ['寅', '午', '戌'], element: '火' },
  { branches: ['亥', '卯', '未'], element: '木' }
];

/** 六十甲子表（预生成） */
const LIU_SHI_JIA_ZI = [];
for (let i = 0; i < 60; i++) {
  LIU_SHI_JIA_ZI.push(TIAN_GAN[i % 10] + DI_ZHI[i % 12]);
}

/**
 * 旬空表
 * 甲子旬戌亥空、甲戌旬申酉空、甲申旬午未空、
 * 甲午旬辰巳空、甲辰旬寅卯空、甲寅旬子丑空
 */
const XUN_KONG = [
  ['戌', '亥'],  // 甲子旬 (索引 0-9)
  ['申', '酉'],  // 甲戌旬 (索引10-19)
  ['午', '未'],  // 甲申旬 (索引20-29)
  ['辰', '巳'],  // 甲午旬 (索引30-39)
  ['寅', '卯'],  // 甲辰旬 (索引40-49)
  ['子', '丑']   // 甲寅旬 (索引50-59)
];

// ============================================================================
// 第二部分：八宫六十四卦数据库
// ============================================================================

/**
 * 六十四卦数据库
 *
 * 每卦包含字段：
 *   name      - 卦名（中文）
 *   palace    - 所属宫名（乾坎艮震巽离坤兑）
 *   lines     - 六爻阴阳 [初爻,二爻,三爻,四爻,五爻,上爻]（true=阳，false=阴）
 *   shiPos    - 世爻位置（1-6，纯卦世在上爻=6）
 *   isPure    - 是否八纯卦（每宫首卦）
 *   isYouHun  - 是否游魂卦
 *   isGuiHun  - 是否归魂卦
 *
 * 应爻位置 = 世爻 + 3（超过6则减6），自动计算
 * 六合卦、六冲卦通过纳甲地支动态计算（见 isLiuHeGua / isLiuChongGua）
 *
 * 八宫卦序（从初爻到上爻）：
 *   每宫8卦，依次为本宫(纯卦)、一世、二世、三世、四世、五世、游魂、归魂
 *   一世变初爻，二世变初二爻，三世变初中三爻，
 *   四世变初中三四爻，五世变初中三四五爻，
 *   游魂（四爻回变），归魂（内卦回变本宫）
 */
const HEXAGRAMS = [
  // ======================== 乾宫（金） ========================
  // 乾为天→天风姤→天山遁→天地否→风地观→山地剥→火地晋(游魂)→火天大有(归魂)
  { name: '乾为天',   palace: '乾', lines: [true, true, true, true, true, true],   shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '天风姤',   palace: '乾', lines: [false, true, true, true, true, true],  shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '天山遁',   palace: '乾', lines: [false, false, true, true, true, true], shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '天地否',   palace: '乾', lines: [false, false, false, true, true, true],shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '风地观',   palace: '乾', lines: [false, false, false, false, true, true], shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '山地剥',   palace: '乾', lines: [false, false, false, false, false, true], shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '火地晋',   palace: '乾', lines: [false, false, false, true, false, true], shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '火天大有', palace: '乾', lines: [true, true, true, true, false, true],  shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true },

  // ======================== 坎宫（水） ========================
  // 坎为水→水泽节→水雷屯→水火既济→泽火革→雷火丰→地火明夷(游魂)→地水师(归魂)
  { name: '坎为水',   palace: '坎', lines: [false, true, false, false, true, false],  shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '水泽节',   palace: '坎', lines: [true, true, false, false, true, false],   shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '水雷屯',   palace: '坎', lines: [true, false, false, false, true, false],  shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '水火既济', palace: '坎', lines: [true, false, true, false, true, false],   shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '泽火革',   palace: '坎', lines: [true, false, true, true, true, false],    shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '雷火丰',   palace: '坎', lines: [true, false, true, true, false, false],   shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '地火明夷', palace: '坎', lines: [true, false, true, false, false, false],  shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '地水师',   palace: '坎', lines: [false, true, false, false, false, false], shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true },

  // ======================== 艮宫（土） ========================
  // 艮为山→山火贲→山天大畜→山泽损→火泽睽→天泽履→风泽中孚(游魂)→风山渐(归魂)
  { name: '艮为山',   palace: '艮', lines: [false, false, true, false, false, true],  shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '山火贲',   palace: '艮', lines: [true, false, true, false, false, true],   shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '山天大畜', palace: '艮', lines: [true, true, true, false, false, true],    shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '山泽损',   palace: '艮', lines: [true, true, false, false, false, true],   shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '火泽睽',   palace: '艮', lines: [true, true, false, true, false, true],    shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '天泽履',   palace: '艮', lines: [true, true, false, true, true, true],     shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '风泽中孚', palace: '艮', lines: [true, true, false, false, true, true],    shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '风山渐',   palace: '艮', lines: [false, false, true, false, true, true],   shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true },

  // ======================== 震宫（木） ========================
  // 震为雷→雷地豫→雷水解→雷风恒→地风升→水风井→泽风大过(游魂)→泽雷随(归魂)
  { name: '震为雷',   palace: '震', lines: [true, false, false, true, false, false],  shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '雷地豫',   palace: '震', lines: [false, false, false, true, false, false], shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '雷水解',   palace: '震', lines: [false, true, false, true, false, false],  shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '雷风恒',   palace: '震', lines: [false, true, true, true, false, false],   shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '地风升',   palace: '震', lines: [false, true, true, false, false, false],  shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '水风井',   palace: '震', lines: [false, true, true, false, true, false],   shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '泽风大过', palace: '震', lines: [false, true, true, true, true, false],    shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '泽雷随',   palace: '震', lines: [true, false, false, true, true, false],   shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true },

  // ======================== 巽宫（木） ========================
  // 巽为风→风天小畜→风火家人→风雷益→天雷无妄→火雷噬嗑→山雷颐(游魂)→山风蛊(归魂)
  { name: '巽为风',   palace: '巽', lines: [false, true, true, false, true, true],   shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '风天小畜', palace: '巽', lines: [true, true, true, false, true, true],    shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '风火家人', palace: '巽', lines: [true, false, true, false, true, true],   shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '风雷益',   palace: '巽', lines: [true, false, false, false, true, true],  shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '天雷无妄', palace: '巽', lines: [true, false, false, true, true, true],   shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '火雷噬嗑', palace: '巽', lines: [true, false, false, true, false, true],  shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '山雷颐',   palace: '巽', lines: [true, false, false, false, false, true], shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '山风蛊',   palace: '巽', lines: [false, true, true, false, false, true],  shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true },

  // ======================== 离宫（火） ========================
  // 离为火→火山旅→火风鼎→火水未济→山水蒙→风水涣→天水讼(游魂)→天火同人(归魂)
  { name: '离为火',   palace: '离', lines: [true, false, true, true, false, true],   shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '火山旅',   palace: '离', lines: [false, false, true, true, false, true],  shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '火风鼎',   palace: '离', lines: [false, true, true, true, false, true],   shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '火水未济', palace: '离', lines: [false, true, false, true, false, true],  shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '山水蒙',   palace: '离', lines: [false, true, false, false, false, true], shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '风水涣',   palace: '离', lines: [false, true, false, false, true, true],  shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '天水讼',   palace: '离', lines: [false, true, false, true, true, true],   shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '天火同人', palace: '离', lines: [true, false, true, true, true, true],    shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true },

  // ======================== 坤宫（土） ========================
  // 坤为地→地雷复→地泽临→地天泰→雷天大壮→泽天夬→水天需(游魂)→水地比(归魂)
  { name: '坤为地',   palace: '坤', lines: [false, false, false, false, false, false], shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '地雷复',   palace: '坤', lines: [true, false, false, false, false, false], shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '地泽临',   palace: '坤', lines: [true, true, false, false, false, false],  shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '地天泰',   palace: '坤', lines: [true, true, true, false, false, false],   shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '雷天大壮', palace: '坤', lines: [true, true, true, true, false, false],    shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '泽天夬',   palace: '坤', lines: [true, true, true, true, true, false],     shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '水天需',   palace: '坤', lines: [true, true, true, false, true, false],    shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '水地比',   palace: '坤', lines: [false, false, false, false, true, false], shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true },

  // ======================== 兑宫（金） ========================
  // 兑为泽→泽水困→泽地萃→泽山咸→水山蹇→地山谦→雷山小过(游魂)→雷泽归妹(归魂)
  { name: '兑为泽',   palace: '兑', lines: [true, true, false, true, true, false],   shiPos: 6, isPure: true,  isYouHun: false, isGuiHun: false },
  { name: '泽水困',   palace: '兑', lines: [false, true, false, true, true, false],  shiPos: 1, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '泽地萃',   palace: '兑', lines: [false, false, false, true, true, false], shiPos: 2, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '泽山咸',   palace: '兑', lines: [false, false, true, true, true, false],  shiPos: 3, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '水山蹇',   palace: '兑', lines: [false, false, true, false, true, false], shiPos: 4, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '地山谦',   palace: '兑', lines: [false, false, true, false, false, false],shiPos: 5, isPure: false, isYouHun: false, isGuiHun: false },
  { name: '雷山小过', palace: '兑', lines: [false, false, true, true, false, false], shiPos: 4, isPure: false, isYouHun: true,  isGuiHun: false },
  { name: '雷泽归妹', palace: '兑', lines: [true, true, false, true, false, false],  shiPos: 3, isPure: false, isYouHun: false, isGuiHun: true }
];

/** 卦名索引（快速查找） */
const HEXAGRAM_NAME_INDEX = {};
/** 卦象索引（按阴阳数组快速查找） */
const HEXAGRAM_LINES_INDEX = {};
for (const hex of HEXAGRAMS) {
  HEXAGRAM_NAME_INDEX[hex.name] = hex;
  HEXAGRAM_LINES_INDEX[hex.lines.join(',')] = hex;
}

// ============================================================================
// 第三部分：基础工具函数
// ============================================================================

/**
 * 解析干支柱字符串
 * @param {string} pillar - 干支柱（如"丙午"）
 * @returns {{gan: string, zhi: string}|null}
 */
function parsePillar(pillar) {
  if (!pillar || typeof pillar !== 'string' || pillar.length < 2) return null;
  return { gan: pillar[0], zhi: pillar[1] };
}

/**
 * 根据天干地支获取六十甲子索引
 * 使用公式: index = (ganIdx * 6 - zhiIdx * 5 + 60) % 60
 * @param {string} gan - 天干
 * @param {string} zhi - 地支
 * @returns {number} 0-59 的索引值，-1 表示无效
 */
function getJiaZiIndex(gan, zhi) {
  const ganIdx = TIAN_GAN.indexOf(gan);
  const zhiIdx = DI_ZHI.indexOf(zhi);
  if (ganIdx === -1 || zhiIdx === -1) return -1;
  return (ganIdx * 6 - zhiIdx * 5 + 60) % 60;
}

/**
 * 根据阴阳数组识别经卦名
 * @param {boolean[]} lines - 三爻阴阳数组 [初爻, 中爻, 上爻]
 * @returns {string|null} 经卦名
 */
function identifyTrigram(lines) {
  return BA_GUA_REVERSE[lines.join(',')] || null;
}

/**
 * 根据天干地支判断五行
 * @param {string} ganZhi - 干支字符串（如"丙午"）
 * @returns {{gan: string, zhi: string, ganElement: string, zhiElement: string}|null}
 */
function getGanZhiElement(ganZhi) {
  const pillar = parsePillar(ganZhi);
  if (!pillar) return null;
  return {
    gan: pillar.gan,
    zhi: pillar.zhi,
    ganElement: GAN_WU_XING[pillar.gan],
    zhiElement: ZHI_WU_XING[pillar.zhi]
  };
}

/**
 * 查找卦象（通过卦名或阴阳数组）
 * @param {string|boolean[]} nameOrLines - 卦名或六爻阴阳数组
 * @returns {Object|null} 卦象数据
 */
function findHexagram(nameOrLines) {
  if (typeof nameOrLines === 'string') {
    return HEXAGRAM_NAME_INDEX[nameOrLines] || null;
  } else if (Array.isArray(nameOrLines)) {
    return HEXAGRAM_LINES_INDEX[nameOrLines.join(',')] || null;
  }
  return null;
}

// ============================================================================
// 第四部分：纳甲装卦
// ============================================================================

/**
 * 为六爻卦装纳甲（天干地支）
 *
 * 根据内卦和外卦的实际卦象分别纳甲。
 * 例：天水讼——外卦乾用乾外卦纳甲（壬午壬申壬戌），
 *               内卦坎用坎内卦纳甲（戊寅戊辰戊午）。
 *
 * @param {Object} hexagram - 卦象数据（含 lines 字段）
 * @returns {Array} 六爻纳甲信息数组（从初爻到上爻），每项含：
 *   { gan, zhi, ganZhi, trigram, isInner }
 */
function applyNaJia(hexagram) {
  const lines = hexagram.lines;

  // 提取内卦（初、二、三爻）和外卦（四、五、上爻）
  const innerTrigram = [lines[0], lines[1], lines[2]];
  const outerTrigram = [lines[3], lines[4], lines[5]];

  // 识别内外经卦
  const innerName = identifyTrigram(innerTrigram);
  const outerName = identifyTrigram(outerTrigram);

  // 获取纳甲数据
  const innerNaJia = NA_JIA_TABLE[innerName];
  const outerNaJia = NA_JIA_TABLE[outerName];

  const result = [];

  // 初爻、二爻、三爻（内卦）
  for (let i = 0; i < 3; i++) {
    result.push({
      gan: innerNaJia.innerGan,
      zhi: innerNaJia.innerZhi[i],
      ganZhi: innerNaJia.innerGan + innerNaJia.innerZhi[i],
      trigram: innerName,
      isInner: true
    });
  }

  // 四爻、五爻、上爻（外卦）
  for (let i = 0; i < 3; i++) {
    result.push({
      gan: outerNaJia.outerGan,
      zhi: outerNaJia.outerZhi[i],
      ganZhi: outerNaJia.outerGan + outerNaJia.outerZhi[i],
      trigram: outerName,
      isInner: false
    });
  }

  return result;
}

// ============================================================================
// 第五部分：六亲配卦
// ============================================================================

/**
 * 根据地支五行和宫五行确定六亲
 *
 * 规则：
 *   生我者为父母（地支五行生宫五行）
 *   我生者为子孙（宫五行生地支五行）
 *   克我者为官鬼（地支五行克宫五行）
 *   我克者为妻财（宫五行克地支五行）
 *   比和者为兄弟（地支五行同宫五行）
 *
 * @param {string} branchElement - 地支五行
 * @param {string} palaceElement - 宫五行
 * @returns {string} 六亲名称
 */
function getLiuQin(branchElement, palaceElement) {
  if (branchElement === palaceElement) return '兄弟';        // 比和
  if (SHENG[branchElement] === palaceElement) return '父母'; // 生我者（地支生宫）
  if (SHENG[palaceElement] === branchElement) return '子孙'; // 我生者（宫生地支）
  if (KE[branchElement] === palaceElement) return '官鬼';    // 克我者（地支克宫）
  if (KE[palaceElement] === branchElement) return '妻财';    // 我克者（宫克地支）
  return '未知';
}

/**
 * 为六爻批量配六亲
 * @param {Array} najiaResult - 纳甲结果数组
 * @param {string} palace - 宫名（用于确定宫五行）
 * @returns {Array} 六亲名称数组
 */
function applyLiuQin(najiaResult, palace) {
  const palaceElement = GONG_WU_XING[palace];
  return najiaResult.map(item => {
    const branchElement = ZHI_WU_XING[item.zhi];
    return getLiuQin(branchElement, palaceElement);
  });
}

// ============================================================================
// 第六部分：六神配卦
// ============================================================================

/**
 * 根据日干确定六神
 *
 * 甲乙日-青龙起初爻，丙丁日-朱雀起初爻，戊日-勾陈起初爻，
 * 己日-螣蛇起初爻，庚辛日-白虎起初爻，壬癸日-玄武起初爻。
 * 从初爻到上爻依次循环：青龙、朱雀、勾陈、螣蛇、白虎、玄武。
 *
 * @param {string} dayGan - 日干
 * @returns {Array} 六神数组（从初爻到上爻）
 */
function applyLiuShen(dayGan) {
  const ganIdx = TIAN_GAN.indexOf(dayGan);
  let startIdx;

  if (ganIdx <= 1) startIdx = 0;        // 甲乙 → 青龙起初爻
  else if (ganIdx <= 3) startIdx = 1;    // 丙丁 → 朱雀起初爻
  else if (ganIdx === 4) startIdx = 2;   // 戊   → 勾陈起初爻
  else if (ganIdx === 5) startIdx = 3;   // 己   → 螣蛇起初爻
  else if (ganIdx <= 7) startIdx = 4;    // 庚辛 → 白虎起初爻
  else startIdx = 5;                      // 壬癸 → 玄武起初爻

  const result = [];
  for (let i = 0; i < 6; i++) {
    result.push(LIU_SHEN_NAMES[(startIdx + i) % 6]);
  }
  return result;
}

// ============================================================================
// 第七部分：天干地支转换函数（空亡、六合六冲、三合三刑、生旺墓绝）
// ============================================================================

/**
 * 计算空亡（旬空）
 *
 * 根据日柱干支推算当前旬的空亡地支：
 *   甲子旬戌亥空，甲戌旬申酉空，甲申旬午未空，
 *   甲午旬辰巳空，甲辰旬寅卯空，甲寅旬子丑空
 *
 * @param {string} dayGan - 日干
 * @param {string} dayZhi - 日支
 * @returns {string[]} 空亡地支数组（两个地支）
 */
function getKongWang(dayGan, dayZhi) {
  const idx = getJiaZiIndex(dayGan, dayZhi);
  if (idx === -1) return [];
  const xunIdx = Math.floor(idx / 10);
  return XUN_KONG[xunIdx];
}

/** 判断两个地支是否六合 */
function isLiuHe(zhi1, zhi2) {
  return LIU_HE_MAP[zhi1] === zhi2;
}

/** 判断两个地支是否六冲 */
function isLiuChong(zhi1, zhi2) {
  return LIU_CHONG_MAP[zhi1] === zhi2;
}

/** 判断两个地支是否相刑 */
function isXing(zhi1, zhi2) {
  return XING_MAP[zhi1] ? XING_MAP[zhi1].includes(zhi2) : false;
}

/**
 * 检查一组地支中是否形成三合局
 * 申子辰水局、巳酉丑金局、寅午戌火局、亥卯未木局
 *
 * @param {string[]} branches - 地支数组
 * @returns {Array} 三合局信息数组，每项含 { branches, element, desc }
 */
function checkSanHe(branches) {
  const results = [];
  for (const group of SAN_HE_GROUPS) {
    const allPresent = group.branches.every(b => branches.includes(b));
    if (allPresent) {
      results.push({
        branches: [...group.branches],
        element: group.element,
        desc: group.branches.join('') + group.element + '局'
      });
    }
  }
  return results;
}

/**
 * 检查一组地支中是否形成三刑
 * 寅巳申三刑（无恩之刑）、子卯相刑（无礼之刑）、
 * 丑戌未三刑（恃势之刑）、辰午酉亥自刑
 *
 * @param {string[]} branches - 地支数组
 * @returns {Array} 三刑信息数组，每项含 { type, branches }
 */
function checkSanXing(branches) {
  const results = [];
  const uniqueBranches = [...new Set(branches)];

  // 寅巳申三刑（无恩之刑）
  if (uniqueBranches.includes('寅') && uniqueBranches.includes('巳') && uniqueBranches.includes('申')) {
    results.push({ type: '无恩之刑', branches: ['寅', '巳', '申'] });
  }
  // 子卯相刑（无礼之刑）
  if (uniqueBranches.includes('子') && uniqueBranches.includes('卯')) {
    results.push({ type: '无礼之刑', branches: ['子', '卯'] });
  }
  // 丑戌未三刑（恃势之刑）
  if (uniqueBranches.includes('丑') && uniqueBranches.includes('戌') && uniqueBranches.includes('未')) {
    results.push({ type: '恃势之刑', branches: ['丑', '戌', '未'] });
  }
  // 自刑：辰午酉亥（同支出现两次以上）
  const ziXingBranches = ['辰', '午', '酉', '亥'];
  for (const b of ziXingBranches) {
    const count = branches.filter(x => x === b).length;
    if (count >= 2) {
      results.push({ type: '自刑', branches: [b, b] });
    }
  }
  return results;
}

/**
 * 计算长生十二宫状态
 *
 * 金长生巳旺酉墓丑绝寅；木长生亥旺卯墓未绝申；
 * 水（土同水）长生申旺子墓辰绝巳；火长生寅旺午墓戌绝亥
 *
 * 十二宫顺序：长生→沐浴→冠带→临官→帝旺→衰→病→死→墓→绝→胎→养
 *
 * @param {string} element - 五行
 * @param {string} branch - 地支
 * @returns {string} 十二宫状态名
 */
function getChangSheng(element, branch) {
  const startZhi = CHANG_SHENG_START[element];
  if (!startZhi) return '未知';
  const startIdx = DI_ZHI.indexOf(startZhi);
  const branchIdx = DI_ZHI.indexOf(branch);
  if (startIdx === -1 || branchIdx === -1) return '未知';
  const offset = (branchIdx - startIdx + 12) % 12;
  return SHI_ER_GONG_NAMES[offset];
}

// ============================================================================
// 第七部分之二：月破日破、暗动、进神退神、回头生克、化墓化绝、互错综卦
// ============================================================================

/**
 * 进神映射（《增删卜易·进神退神章》）
 * 进神：寅化卯、巳化午、申化酉、亥化子、丑化辰、辰化未、未化戌、戌化丑
 * 退神为其反向
 */
const JIN_SHEN_MAP = { '寅': '卯', '巳': '午', '申': '酉', '亥': '子', '丑': '辰', '辰': '未', '未': '戌', '戌': '丑' };
const TUI_SHEN_MAP = { '卯': '寅', '午': '巳', '酉': '申', '子': '亥', '辰': '丑', '未': '辰', '戌': '未', '丑': '戌' };

/** 判断动爻变爻是否化进神/退神 */
function getJinTuiShen(fromZhi, toZhi) {
  if (!fromZhi || !toZhi) return null;
  if (JIN_SHEN_MAP[fromZhi] === toZhi) return '进神';
  if (TUI_SHEN_MAP[fromZhi] === toZhi) return '退神';
  return null;
}

/** 判断爻是否月破（与月支相冲） */
function isYuePo(zhi, monthZhi) {
  return LIU_CHONG_MAP[monthZhi] === zhi;
}

/**
 * 判断静爻被日冲后的状态（《增删卜易》：旺相之爻被日冲为暗动，休囚之爻被日冲为日破）
 * @returns {string|null} '暗动' | '日破' | null
 */
function getRiChongState(zhi, dayZhi, wangShuai, isMoving) {
  if (isMoving) return null;             // 暗动/日破专指静爻
  if (LIU_CHONG_MAP[dayZhi] !== zhi) return null;
  return (wangShuai === '旺' || wangShuai === '相') ? '暗动' : '日破';
}

/**
 * 判断动爻变爻与本位爻的回头关系
 * 《增删卜易·动变生克章》：变出之爻只能生克冲合本位之动爻
 * @returns {string|null} '回头生' | '回头克' | '化墓' | '化绝' | '化进神' | '化退神' | null
 */
function getHuiTouRelation(fromElement, fromZhi, toElement, toZhi) {
  if (!fromElement || !toElement || !fromZhi || !toZhi) return null;
  if (SHENG[toElement] === fromElement) return '回头生';
  if (KE[toElement] === fromElement) return '回头克';
  // 化墓化绝：以本位动爻五行查变爻地支的十二宫状态
  const cs = getChangSheng(fromElement, toZhi);
  if (cs === '墓') return '化墓';
  if (cs === '绝') return '化绝';
  return null;
}

/** 互卦：二三四爻为下卦、三四五爻为上卦 */
function getHuGuaLines(lines) {
  return [lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]];
}

/** 错卦：六爻全部取反 */
function getCuoGuaLines(lines) {
  return lines.map(l => !l);
}

/** 综卦：上下颠倒（初↔上、二↔五、三↔四） */
function getZongGuaLines(lines) {
  return [lines[5], lines[4], lines[3], lines[2], lines[1], lines[0]];
}

/**
 * 64卦卦辞库（通行本《周易》）
 * 供排盘结果展示与AI解读参考；爻辞未收录，仅提供卦辞层
 */
const GUA_CI = {
  '乾为天': '乾：元，亨，利，贞。',
  '天风姤': '姤：女壮，勿用取女。',
  '天山遁': '遁：亨，小利贞。',
  '天地否': '否：否之匪人，不利君子贞，大往小来。',
  '风地观': '观：盥而不荐，有孚颙若。',
  '山地剥': '剥：不利有攸往。',
  '火地晋': '晋：康侯用锡马蕃庶，昼日三接。',
  '火天大有': '大有：元亨。',
  '坎为水': '习坎：有孚，维心亨，行有尚。',
  '水泽节': '节：亨。苦节不可贞。',
  '水雷屯': '屯：元亨利贞，勿用有攸往，利建侯。',
  '水火既济': '既济：亨小，利贞。初吉终乱。',
  '泽火革': '革：巳日乃孚，元亨利贞，悔亡。',
  '雷火丰': '丰：亨，王假之，勿忧，宜日中。',
  '地火明夷': '明夷：利艰贞。',
  '地水师': '师：贞，丈人吉，无咎。',
  '艮为山': '艮：艮其背，不获其身；行其庭，不见其人，无咎。',
  '山火贲': '贲：亨。小利有攸往。',
  '山天大畜': '大畜：利贞，不家食吉，利涉大川。',
  '山泽损': '损：有孚，元吉，无咎，可贞，利有攸往。曷之用？二簋可用享。',
  '火泽睽': '睽：小事吉。',
  '天泽履': '履：履虎尾，不咥人，亨。',
  '风泽中孚': '中孚：豚鱼吉，利涉大川，利贞。',
  '风山渐': '渐：女归吉，利贞。',
  '震为雷': '震：亨。震来虩虩，笑言哑哑。震惊百里，不丧匕鬯。',
  '雷地豫': '豫：利建侯行师。',
  '雷水解': '解：利西南，无所往，其来复吉。有攸往夙吉。',
  '雷风恒': '恒：亨，无咎，利贞，利有攸往。',
  '地风升': '升：元亨，用见大人，勿恤，南征吉。',
  '水风井': '井：改邑不改井，无丧无得，往来井井。汔至亦未繘井，羸其瓶，凶。',
  '泽风大过': '大过：栋桡，利有攸往，亨。',
  '泽雷随': '随：元亨利贞，无咎。',
  '巽为风': '巽：小亨，利有攸往，利见大人。',
  '风天小畜': '小畜：亨。密云不雨，自我西郊。',
  '风火家人': '家人：利女贞。',
  '风雷益': '益：利有攸往，利涉大川。',
  '天雷无妄': '无妄：元亨利贞。其匪正有眚，不利有攸往。',
  '火雷噬嗑': '噬嗑：亨。利用狱。',
  '山雷颐': '颐：贞吉。观颐，自求口实。',
  '山风蛊': '蛊：元亨，利涉大川。先甲三日，后甲三日。',
  '离为火': '离：利贞，亨。畜牝牛，吉。',
  '火山旅': '旅：小亨，旅贞吉。',
  '火风鼎': '鼎：元吉，亨。',
  '火水未济': '未济：亨，小狐汔济，濡其尾，无攸利。',
  '山水蒙': '蒙：亨。匪我求童蒙，童蒙求我。初筮告，再三渎，渎则不告。利贞。',
  '风水涣': '涣：亨。王假有庙，利涉大川，利贞。',
  '天水讼': '讼：有孚窒惕，中吉，终凶。利见大人，不利涉大川。',
  '天火同人': '同人：同人于野，亨。利涉大川，利君子贞。',
  '坤为地': '坤：元亨，利牝马之贞。君子有攸往，先迷后得主，利西南得朋，东北丧朋。安贞吉。',
  '地雷复': '复：亨。出入无疾，朋来无咎。反复其道，七日来复，利有攸往。',
  '地泽临': '临：元亨利贞。至于八月有凶。',
  '地天泰': '泰：小往大来，吉，亨。',
  '雷天大壮': '大壮：利贞。',
  '泽天夬': '夬：扬于王庭，孚号有厉。告自邑，不利即戎，利有攸往。',
  '水天需': '需：有孚，光亨，贞吉。利涉大川。',
  '水地比': '比：吉。原筮，元永贞，无咎。不宁方来，后夫凶。',
  '兑为泽': '兑：亨，利贞。',
  '泽水困': '困：亨，贞，大人吉，无咎。有言不信。',
  '泽地萃': '萃：亨。王假有庙，利见大人，亨，利贞。用大牲吉，利有攸往。',
  '泽山咸': '咸：亨，利贞，取女吉。',
  '水山蹇': '蹇：利西南，不利东北；利见大人，贞吉。',
  '地山谦': '谦：亨，君子有终。',
  '雷山小过': '小过：亨，利贞，可小事，不可大事。飞鸟遗之音，不宜上，宜下，大吉。',
  '雷泽归妹': '归妹：征凶，无攸利。'
};

/** 获取卦辞 */
function getGuaCi(name) {
  return GUA_CI[name] || null;
}

// ============================================================================
// 第八部分：月建旺衰计算
// ============================================================================

/**
 * 根据月支获取季节五行
 * 春（寅卯）木、夏（巳午）火、秋（申酉）金、冬（亥子）水、四季月（辰戌丑未）土
 */
function getSeasonElement(monthZhi) {
  if (monthZhi === '寅' || monthZhi === '卯') return '木';
  if (monthZhi === '巳' || monthZhi === '午') return '火';
  if (monthZhi === '申' || monthZhi === '酉') return '金';
  if (monthZhi === '亥' || monthZhi === '子') return '水';
  return '土'; // 辰戌丑未
}

/**
 * 获取月建余气信息
 * 辰月木有余气、未月火有余气、丑月水有余气
 */
function getYuQi(monthZhi) {
  const yuQiMap = { '辰': '木', '未': '火', '丑': '水' };
  return yuQiMap[monthZhi] || null;
}

/**
 * 计算某五行在月建下的旺衰状态
 *
 * 旺相休囚死规则：
 *   旺：与月建同行（同我者旺）
 *   相：月建生之（我生者相）
 *   休：生月建者（生我者休）
 *   囚：克月建者（克我者囚）
 *   死：月建克之（我克者死）
 *
 * 各月旺衰：
 *   正月二月（寅卯）：木旺火相，金水土休囚
 *   三月（辰）：土旺金相，木有余气
 *   四月五月（巳午）：火旺土相，金水土休囚
 *   六月（未）：土旺金相，火有余气
 *   七月八月（申酉）：金旺水相，木火土休囚
 *   九月（戌）：土旺金相
 *   十月十一月（亥子）：水旺木相，金火土休囚
 *   十二月（丑）：土旺金相，水有余气
 *
 * @param {string} element - 要判断的五行
 * @param {string} monthZhi - 月支
 * @returns {string} 旺衰状态（旺/相/休/囚/死）
 */
function getWangShuai(element, monthZhi) {
  const seasonElement = getSeasonElement(monthZhi);

  // 月建余气：《增删卜易·四时旺相章》——辰月木、未月火、丑月水"虽衰，还有余气"，
  // 不作休囚论；戌月金无余气（土生金已作相论）。余气以"相"论，冲之则暗动。
  const yuQi = getYuQi(monthZhi);
  if (yuQi && element === yuQi) return '相';

  if (element === seasonElement) return '旺';               // 同我者旺
  if (SHENG[seasonElement] === element) return '相';         // 我生者相
  if (SHENG[element] === seasonElement) return '休';         // 生我者休
  if (KE[element] === seasonElement) return '囚';            // 克我者囚
  if (KE[seasonElement] === element) return '死';            // 我克者死
  return '未知';
}

/**
 * 批量计算六爻在月建下的旺衰和长生十二宫
 * @param {Array} najiaResult - 纳甲结果
 * @param {string} monthZhi - 月支
 * @returns {Array} 每爻的 { wangShuai, changSheng, element }
 */
function applyWangShuai(najiaResult, monthZhi) {
  return najiaResult.map(item => {
    const element = ZHI_WU_XING[item.zhi];
    return {
      wangShuai: getWangShuai(element, monthZhi),
      changSheng: getChangSheng(element, item.zhi),
      element: element
    };
  });
}

// ============================================================================
// 第九部分：伏神检测（缺爻检测）
// ============================================================================

/**
 * 检测伏神（缺爻检测）
 *
 * 当卦中缺少某个六亲时，从本宫首卦（八纯卦）中借用对应爻的地支，
 * 伏于当前卦对应爻位之下，称为"伏神"。
 *
 * 原理：每宫首卦（纯卦）六爻俱全，包含全部五种六亲。
 *       若当前卦缺少某六亲，则在纯卦中找到该六亲对应的爻，
 *       其纳甲地支即为伏神，伏于当前卦同位爻之下。
 *
 * @param {Array} najiaResult - 当前卦的纳甲结果
 * @param {Array} liuQinResult - 当前卦的六亲结果
 * @param {string} palace - 宫名
 * @returns {Array} 伏神信息数组，每项含：
 *   { liuQin, position, gan, zhi, ganZhi, element, hideUnder, hideUnderLiuQin }
 */
function detectFuShen(najiaResult, liuQinResult, palace) {
  // 获取本宫首卦（八纯卦）
  const pureHexagram = HEXAGRAMS.find(h => h.palace === palace && h.isPure);
  if (!pureHexagram) return [];

  // 计算纯卦的纳甲和六亲
  const pureNaJia = applyNaJia(pureHexagram);
  const palaceElement = GONG_WU_XING[palace];
  const pureLiuQin = pureNaJia.map(item =>
    getLiuQin(ZHI_WU_XING[item.zhi], palaceElement)
  );

  // 获取当前卦已有的六亲集合
  const presentLiuQin = new Set(liuQinResult);

  // 找出缺失的六亲
  const missingLiuQin = LIU_QIN_NAMES.filter(lq => !presentLiuQin.has(lq));

  // 为每个缺失的六亲从纯卦中找伏神
  const fuShenList = [];
  for (const missing of missingLiuQin) {
    // 在纯卦中找到该六亲对应的爻位
    const idx = pureLiuQin.indexOf(missing);
    if (idx !== -1) {
      fuShenList.push({
        liuQin: missing,                           // 缺失的六亲
        position: idx + 1,                          // 伏神所在爻位（1-6）
        gan: pureNaJia[idx].gan,                    // 伏神天干
        zhi: pureNaJia[idx].zhi,                    // 伏神地支
        ganZhi: pureNaJia[idx].ganZhi,             // 伏神干支
        element: ZHI_WU_XING[pureNaJia[idx].zhi],  // 伏神五行
        hideUnder: najiaResult[idx].ganZhi,        // 伏于何爻之下
        hideUnderLiuQin: liuQinResult[idx]          // 所伏之爻的六亲
      });
    }
  }
  return fuShenList;
}

// ============================================================================
// 第十部分：六合卦/六冲卦检测
// ============================================================================

/**
 * 检测卦象是否为六合卦
 *
 * 六合卦：初爻与四爻、二爻与五爻、三爻与上爻的地支均为六合
 * 动态计算结果共8个：水泽节、地雷复、地天泰、山火贲、天地否、雷地豫、泽水困、火山旅
 *
 * @param {Array} najiaResult - 纳甲结果
 * @returns {boolean}
 */
function isLiuHeGua(najiaResult) {
  for (let i = 0; i < 3; i++) {
    const zhi1 = najiaResult[i].zhi;       // 初/二/三爻
    const zhi2 = najiaResult[i + 3].zhi;   // 四/五/上爻
    if (!isLiuHe(zhi1, zhi2)) return false;
  }
  return true;
}

/**
 * 检测卦象是否为六冲卦
 *
 * 六冲卦：初爻与四爻、二爻与五爻、三爻与上爻的地支均为六冲
 * 动态计算结果共10个：八纯卦（乾坎艮震巽离坤兑）+ 雷天大壮 + 天雷无妄
 *
 * @param {Array} najiaResult - 纳甲结果
 * @returns {boolean}
 */
function isLiuChongGua(najiaResult) {
  for (let i = 0; i < 3; i++) {
    const zhi1 = najiaResult[i].zhi;
    const zhi2 = najiaResult[i + 3].zhi;
    if (!isLiuChong(zhi1, zhi2)) return false;
  }
  return true;
}

// ============================================================================
// 第十一部分：单卦排盘（内部函数）
// ============================================================================

/**
 * 对单个卦象进行完整排盘
 *
 * @param {Object} hexData - 卦象数据（来自 HEXAGRAMS）
 * @param {string} dayGan - 日干
 * @param {string} dayZhi - 日支
 * @param {string} monthZhi - 月支
 * @param {Object} [options] - 额外选项
 * @param {string} [options.originalPalace] - 原始宫名（变卦六亲用本宫五行，默认为hexData.palace）
 * @param {number[]} [options.movingLines] - 动爻位置数组（0-based）
 * @param {Object} [options.changedHexData] - 变卦数据（用于计算动变信息）
 * @param {boolean} [options.computeFuShen=true] - 是否计算伏神
 * @returns {Object} 单卦排盘结果
 */
function castSingleHexagram(hexData, dayGan, dayZhi, monthZhi, options) {
  options = options || {};
  const originalPalace = options.originalPalace || hexData.palace;
  const movingLines = options.movingLines || [];
  const changedHexData = options.changedHexData || null;
  const computeFuShen = options.computeFuShen !== false;

  // --- 基本信息 ---
  const palace = hexData.palace;
  const palaceElement = GONG_WU_XING[originalPalace]; // 六亲用原始宫五行

  // 世应位置
  const shiPos = hexData.shiPos;
  const yingPos = (shiPos + 3) > 6 ? (shiPos + 3 - 6) : (shiPos + 3);

  // --- 纳甲 ---
  const najia = applyNaJia(hexData);

  // --- 六亲（基于原始宫五行） ---
  const liuQin = applyLiuQin(najia, originalPalace);

  // --- 六神（基于日干） ---
  const liuShen = applyLiuShen(dayGan);

  // --- 旺衰（基于月建） ---
  const wangShuaiInfo = applyWangShuai(najia, monthZhi);

  // --- 空亡 ---
  const kongWang = getKongWang(dayGan, dayZhi);

  // --- 伏神 ---
  const fuShen = computeFuShen ? detectFuShen(najia, liuQin, originalPalace) : [];

  // --- 日月五行 ---
  const dayZhiElement = ZHI_WU_XING[dayZhi];
  const monthZhiElement = ZHI_WU_XING[monthZhi];

  // --- 变卦纳甲（如有） ---
  let changedNaJia = null;
  let changedLiuQin = null;
  if (changedHexData) {
    changedNaJia = applyNaJia(changedHexData);
    changedLiuQin = applyLiuQin(changedNaJia, originalPalace); // 变卦六亲用本宫五行
  }

  // --- 组装六爻信息 ---
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const zhi = najia[i].zhi;
    const zhiElement = ZHI_WU_XING[zhi];
    const isMoving = movingLines.includes(i);
    const isKongWang = kongWang.includes(zhi);

    // 日建对各爻的影响
    const dayImpact = {
      sheng:  SHENG[dayZhiElement] === zhiElement,    // 日生此爻
      fu:     dayZhiElement === zhiElement,            // 日比和（扶）此爻
      ke:     KE[dayZhiElement] === zhiElement,        // 日克此爻
      xie:    SHENG[zhiElement] === dayZhiElement,     // 此爻生日（泄气）
      hao:    KE[zhiElement] === dayZhiElement,        // 此爻克日（耗力）
      chong:  isLiuChong(dayZhi, zhi),                 // 日冲此爻
      he:     isLiuHe(dayZhi, zhi),                    // 日合此爻
      xing:   isXing(dayZhi, zhi),                     // 日刑此爻
      desc:   ''                                        // 文字描述
    };
    dayImpact.desc = buildImpactDesc(dayImpact, '日');

    // 月建对各爻的影响
    const monthImpact = {
      sheng:  SHENG[monthZhiElement] === zhiElement,   // 月生此爻
      fu:     monthZhiElement === zhiElement,           // 月比和（扶）此爻
      ke:     KE[monthZhiElement] === zhiElement,       // 月克此爻
      xie:    SHENG[zhiElement] === monthZhiElement,    // 此爻生月（泄气）
      hao:    KE[zhiElement] === monthZhiElement,       // 此爻克月（耗力）
      chong:  isLiuChong(monthZhi, zhi),                // 月冲此爻
      he:     isLiuHe(monthZhi, zhi),                   // 月合此爻
      xing:   isXing(monthZhi, zhi),                    // 月刑此爻
      desc:   ''
    };
    monthImpact.desc = buildImpactDesc(monthImpact, '月');

    // 动变信息
    let changedTo = null;
    if (isMoving && changedNaJia) {
      const changedZhi = changedNaJia[i].zhi;
      const changedElement = ZHI_WU_XING[changedZhi];
      // 进神退神与回头生克化墓绝（《增删卜易》动变规则）
      const jinTui = getJinTuiShen(zhi, changedZhi);
      const huiTou = getHuiTouRelation(zhiElement, zhi, changedElement, changedZhi);
      changedTo = {
        yinYang: changedHexData.lines[i],
        gan: changedNaJia[i].gan,
        zhi: changedZhi,
        ganZhi: changedNaJia[i].ganZhi,
        element: changedElement,
        liuQin: changedLiuQin[i],
        changSheng: getChangSheng(changedElement, changedZhi),
        jinTuiShen: jinTui,                        // 进神/退神
        huiTouRelation: huiTou                     // 回头生/回头克/化墓/化绝
      };
    }

    // 月破（《增删卜易》：月冲之爻为月破，"月破为空"）
    const yuePo = isYuePo(zhi, monthZhi);

    // 日冲状态：旺相静爻被日冲为暗动，休囚静爻被日冲为日破
    const riChongState = getRiChongState(zhi, dayZhi, wangShuaiInfo[i].wangShuai, isMoving);

    lines.push({
      position: i + 1,                    // 爻位 1-6
      positionName: getPositionName(i),   // 爻位名称（初/二/三/四/五/上）
      yinYang: hexData.lines[i],           // 阴阳（true=阳，false=阴）
      yinYangStr: hexData.lines[i] ? '阳' : '阴',
      gan: najia[i].gan,                   // 天干
      zhi: zhi,                            // 地支
      ganZhi: najia[i].ganZhi,            // 干支
      element: zhiElement,                 // 地支五行
      liuQin: liuQin[i],                   // 六亲
      liuShen: liuShen[i],                 // 六神
      isWorld: (i + 1) === shiPos,         // 是否世爻
      isResponse: (i + 1) === yingPos,     // 是否应爻
      isMoving: isMoving,                  // 是否动爻
      isKongWang: isKongWang,              // 是否空亡
      isYuePo: yuePo,                      // 是否月破
      riChongState: riChongState,          // 日冲状态（暗动/日破/null）
      wangShuai: wangShuaiInfo[i].wangShuai,     // 月建旺衰
      changSheng: wangShuaiInfo[i].changSheng,   // 长生十二宫
      dayImpact: dayImpact,                // 日建影响
      monthImpact: monthImpact,            // 月建影响
      changedTo: changedTo,                // 动变信息
      trigram: najia[i].trigram,           // 所属经卦
      isInner: najia[i].isInner            // 是否内卦
    });
  }

  // --- 卦象性质标记 ---
  const liuHeGua = isLiuHeGua(najia);
  const liuChongGua = isLiuChongGua(najia);
  const specialMarks = [];
  if (hexData.isPure) specialMarks.push('八纯卦');
  if (hexData.isYouHun) specialMarks.push('游魂卦');
  if (hexData.isGuiHun) specialMarks.push('归魂卦');
  if (liuHeGua) specialMarks.push('六合卦');
  if (liuChongGua) specialMarks.push('六冲卦');

  return {
    name: hexData.name,
    palace: palace,
    palaceElement: GONG_WU_XING[palace],     // 本宫五行（信息展示用）
    liuQinPalace: originalPalace,             // 六亲所用宫
    liuQinPalaceElement: palaceElement,       // 六亲所用宫五行
    shiPos: shiPos,                           // 世爻位置
    yingPos: yingPos,                         // 应爻位置
    lines: lines,                             // 六爻详细信息
    fuShen: fuShen,                           // 伏神信息
    isPure: hexData.isPure,                   // 八纯卦
    isYouHun: hexData.isYouHun,               // 游魂卦
    isGuiHun: hexData.isGuiHun,               // 归魂卦
    isLiuHeGua: liuHeGua,                     // 六合卦
    isLiuChongGua: liuChongGua,               // 六冲卦
    specialMarks: specialMarks                // 特殊性质标记
  };
}

/**
 * 获取爻位名称
 */
function getPositionName(index) {
  const names = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
  return names[index] || '';
}

/**
 * 构建日月影响的文字描述
 */
function buildImpactDesc(impact, label) {
  const parts = [];
  if (impact.sheng) parts.push(label + '生');
  if (impact.fu) parts.push(label + '扶');
  if (impact.ke) parts.push(label + '克');
  if (impact.xie) parts.push(label + '泄');
  if (impact.hao) parts.push(label + '耗');
  if (impact.chong) parts.push(label + '冲');
  if (impact.he) parts.push(label + '合');
  if (impact.xing) parts.push(label + '刑');
  return parts.length > 0 ? parts.join('、') : '';
}

// ============================================================================
// 第十二部分：主排盘函数
// ============================================================================

/**
 * 主排盘函数
 *
 * 输入参数：
 *   - mainHexagram:    主卦名（如"天水讼"）或六爻阴阳数组（如[false,true,false,true,true,true]）
 *   - changedHexagram: 变卦名或变爻位置数组（可选，如"天火同人"或[3]表示三爻动）
 *   - yearPillar:      年柱（如"丙午"）
 *   - monthPillar:     月柱（如"乙未"）
 *   - dayPillar:       日柱（如"甲子"）
 *   - hourPillar:      时柱（如"戊辰"）
 *
 * 输出结构：
 *   - pillars:       四柱信息
 *   - kongWang:      空亡地支
 *   - mainHexagram:  主卦排盘结果
 *   - changedHexagram: 变卦排盘结果（如有动爻）
 *   - sanHe:         三合局信息
 *   - sanXing:       三刑信息
 *   - lineHeChong:   爻间六合六冲信息
 *   - monthYuQi:     月建余气
 *
 * @param {Object} input - 输入参数对象
 * @returns {Object} 完整排盘结果
 */
function mainCast(input) {
  // ========== 1. 解析主卦 ==========
  let mainHexData = null;

  if (typeof input.mainHexagram === 'string') {
    mainHexData = HEXAGRAM_NAME_INDEX[input.mainHexagram];
    if (!mainHexData) {
      return { error: '未找到卦名：' + input.mainHexagram };
    }
  } else if (Array.isArray(input.mainHexagram)) {
    mainHexData = HEXAGRAM_LINES_INDEX[input.mainHexagram.join(',')];
    if (!mainHexData) {
      return { error: '未找到匹配的卦象' };
    }
  } else {
    return { error: '主卦参数无效，请提供卦名或六爻阴阳数组' };
  }

  // ========== 2. 解析四柱 ==========
  const yearPillar = parsePillar(input.yearPillar);
  const monthPillar = parsePillar(input.monthPillar);
  const dayPillar = parsePillar(input.dayPillar);
  const hourPillar = parsePillar(input.hourPillar);

  if (!yearPillar || !monthPillar || !dayPillar || !hourPillar) {
    return { error: '四柱参数格式无效，请使用如"丙午"的天干地支格式' };
  }

  // 提取关键信息
  const dayGan = dayPillar.gan;
  const dayZhi = dayPillar.zhi;
  const monthZhi = monthPillar.zhi;

  // ========== 3. 解析变卦/动爻 ==========
  let movingLines = [];       // 动爻位置（0-based）
  let changedHexData = null;  // 变卦数据

  if (input.changedHexagram !== undefined && input.changedHexagram !== null) {
    if (typeof input.changedHexagram === 'string') {
      // 通过变卦名查找
      changedHexData = HEXAGRAM_NAME_INDEX[input.changedHexagram];
      if (changedHexData) {
        // 比较主卦和变卦，找出变动的爻
        for (let i = 0; i < 6; i++) {
          if (mainHexData.lines[i] !== changedHexData.lines[i]) {
            movingLines.push(i);
          }
        }
      } else {
        return { error: '未找到变卦名：' + input.changedHexagram };
      }
    } else if (Array.isArray(input.changedHexagram)) {
      // 通过变爻位置（1-based）确定动爻
      movingLines = input.changedHexagram.map(p => p - 1);
      // 翻转动爻得到变卦
      const changedLines = [...mainHexData.lines];
      for (const idx of movingLines) {
        if (idx >= 0 && idx < 6) {
          changedLines[idx] = !changedLines[idx];
        }
      }
      changedHexData = HEXAGRAM_LINES_INDEX[changedLines.join(',')];
      if (!changedHexData) {
        return { error: '无法根据动爻确定变卦' };
      }
    }
  }

  // ========== 4. 主卦排盘 ==========
  const mainResult = castSingleHexagram(mainHexData, dayGan, dayZhi, monthZhi, {
    movingLines: movingLines,
    changedHexData: changedHexData,
    computeFuShen: true
  });

  // ========== 5. 变卦排盘（如有动爻） ==========
  let changedResult = null;
  if (changedHexData && movingLines.length > 0) {
    changedResult = castSingleHexagram(changedHexData, dayGan, dayZhi, monthZhi, {
      originalPalace: mainHexData.palace, // 变卦六亲用主卦本宫五行
      movingLines: [],                    // 变卦不再有动爻
      changedHexData: null,
      computeFuShen: false                // 变卦不计算伏神
    });
  }

  // ========== 6. 空亡 ==========
  const kongWang = getKongWang(dayGan, dayZhi);

  // ========== 7. 三合局检测 ==========
  const mainBranches = mainResult.lines.map(l => l.zhi);
  const sanHeResults = checkSanHe(mainBranches);

  // ========== 8. 三刑检测 ==========
  const sanXingResults = checkSanXing(mainBranches);

  // ========== 9. 爻间六合六冲信息 ==========
  const lineHeChong = [];
  for (let i = 0; i < 3; i++) {
    const zhi1 = mainResult.lines[i].zhi;
    const zhi2 = mainResult.lines[i + 3].zhi;
    if (isLiuHe(zhi1, zhi2)) {
      lineHeChong.push({
        type: '六合',
        lines: [i + 1, i + 4],
        branches: [zhi1, zhi2],
        desc: getPositionName(i) + zhi1 + '与' + getPositionName(i + 3) + zhi2 + '六合'
      });
    }
    if (isLiuChong(zhi1, zhi2)) {
      lineHeChong.push({
        type: '六冲',
        lines: [i + 1, i + 4],
        branches: [zhi1, zhi2],
        desc: getPositionName(i) + zhi1 + '与' + getPositionName(i + 3) + zhi2 + '六冲'
      });
    }
  }

  // ========== 9.5 互卦/错卦/综卦 与 卦辞 ==========
  const huGuaData = HEXAGRAM_LINES_INDEX[getHuGuaLines(mainHexData.lines).join(',')];
  const cuoGuaData = HEXAGRAM_LINES_INDEX[getCuoGuaLines(mainHexData.lines).join(',')];
  const zongGuaData = HEXAGRAM_LINES_INDEX[getZongGuaLines(mainHexData.lines).join(',')];
  const guaCi = getGuaCi(mainHexData.name);
  const changedGuaCi = changedHexData ? getGuaCi(changedHexData.name) : null;

  // ========== 10. 组装完整结果 ==========
  const output = {
    // 四柱信息
    pillars: {
      year: { ganZhi: input.yearPillar,  gan: yearPillar.gan,  zhi: yearPillar.zhi,
              ganElement: GAN_WU_XING[yearPillar.gan],  zhiElement: ZHI_WU_XING[yearPillar.zhi] },
      month: { ganZhi: input.monthPillar, gan: monthPillar.gan, zhi: monthPillar.zhi,
               ganElement: GAN_WU_XING[monthPillar.gan], zhiElement: ZHI_WU_XING[monthPillar.zhi] },
      day: { ganZhi: input.dayPillar,   gan: dayPillar.gan,   zhi: dayPillar.zhi,
            ganElement: GAN_WU_XING[dayPillar.gan],   zhiElement: ZHI_WU_XING[dayPillar.zhi] },
      hour: { ganZhi: input.hourPillar,  gan: hourPillar.gan,  zhi: hourPillar.zhi,
              ganElement: GAN_WU_XING[hourPillar.gan],  zhiElement: ZHI_WU_XING[hourPillar.zhi] }
    },

    // 空亡
    kongWang: kongWang,

    // 月建余气
    monthYuQi: getYuQi(monthZhi),

    // 主卦
    mainHexagram: mainResult,

    // 变卦（如有）
    changedHexagram: changedResult,

    // 三合局
    sanHe: sanHeResults,

    // 三刑
    sanXing: sanXingResults,

    // 爻间六合六冲
    lineHeChong: lineHeChong,

    // 互卦/错卦/综卦
    huGua: huGuaData ? huGuaData.name : null,
    cuoGua: cuoGuaData ? cuoGuaData.name : null,
    zongGua: zongGuaData ? zongGuaData.name : null,

    // 卦辞（通行本《周易》）
    guaCi: guaCi,
    changedGuaCi: changedGuaCi,

    // 动爻摘要
    movingLinesSummary: movingLines.map(i => ({
      position: i + 1,
      positionName: getPositionName(i),
      from: mainResult.lines[i].ganZhi,
      fromLiuQin: mainResult.lines[i].liuQin,
      to: changedResult ? changedResult.lines[i].ganZhi : null,
      toLiuQin: changedResult ? changedResult.lines[i].liuQin : null
    }))
  };

  return output;
}

// ============================================================================

// 只公开适配层需要的计算入口与卦表。
module.exports = { mainCast, HEXAGRAMS };
