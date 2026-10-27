/** lunar-javascript 未提供类型声明；以 any 放行，具体字段由 fortune.ts 适配层筛选。 */
declare module 'lunar-javascript' {
  const lunar: any;
  export default lunar;
}