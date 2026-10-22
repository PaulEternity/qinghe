/** 韦特 78 张牌与牌位定义：随机抽取属于程序事实，解释由模型结合问题完成。 */
import {randomInt} from 'node:crypto';
export const SPREADS = {
 single: {name:'单张牌', positions:['当下重点']},
 three: {name:'圣三角三牌', positions:['处境','挑战','建议']},
 celtic: {name:'凯尔特十字', positions:['当前处境','阻碍或助力','意识目标','潜在基础','过去影响','近期趋势','自身态度','外部环境','期望与担忧','可能走向']}
};
export const THREE_MODES = {
 'past-present-future':['过去','现在','未来'],
 'situation-challenge-advice':['处境','挑战','建议'],
 'mind-body-spirit':['心智','身体','灵魂'],
 'you-partner-relationship':['你','对方','关系']
};
const majors='愚者 魔术师 女祭司 皇后 皇帝 教皇 恋人 战车 力量 隐者 命运之轮 正义 倒吊人 死神 节制 恶魔 高塔 星星 月亮 太阳 审判 世界'.split(' ');
const deck=[...majors,...['权杖','圣杯','宝剑','星币'].flatMap(s=>['王牌','二','三','四','五','六','七','八','九','十','侍从','骑士','王后','国王'].map(n=>s+n))].map((name,id)=>({id:`rws-${id}`,name}));
/** 无放回抽牌：固化牌阵、牌位、卡牌 ID 和正逆位，追问不可重抽。 */
export function drawTarot(spread:unknown='three', mode:unknown='situation-challenge-advice') {
 if(typeof spread!=='string'||!Object.hasOwn(SPREADS,spread))throw new Error('牌阵无效');
 if(typeof mode!=='string'||!Object.hasOwn(THREE_MODES,mode))throw new Error('三牌视角无效');
 const definition=SPREADS[spread as keyof typeof SPREADS];
 const positions=spread==='three'?THREE_MODES[mode as keyof typeof THREE_MODES]:definition.positions;
 const remaining=[...deck];
 return {rules:{version:'rws-78-v1',deck:'韦特 78 张',spread,spreadName:definition.name,mode:spread==='three'?mode:null,draw:'crypto.randomInt，无放回，正逆位各 1/2'},cards:positions.map((position,index)=>({...remaining.splice(randomInt(remaining.length),1)[0],index:index+1,position,orientation:randomInt(2)?'正位':'逆位'}))};
}
