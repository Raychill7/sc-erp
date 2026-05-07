/** 校验正数（数量、金额），避免脏数据 */
export function assertPositiveDecimal(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error(`${fieldName} 必须为正数`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

export function assertNonNegativeDecimal(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error(`${fieldName} 不能为负数`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}
