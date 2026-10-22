/** 外部引擎边界声明，具体字段由本工程适配层筛选。 */
declare const engine: {
 mainCast(input: { mainHexagram: boolean[]; changedHexagram: number[] | null; yearPillar: string; monthPillar: string; dayPillar: string; hourPillar: string }): any;
 HEXAGRAMS: {name: string; palace: string; lines: boolean[]; shiPos: number}[];
};
export = engine;
