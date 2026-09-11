// Public receiving-account details approved by the merchant.
export const bankTransfer = Object.freeze({ bank: '농협', account: '302-2049-2431-81', holder: '남영선(히마와리 코리아)' });
export function bankTransferReady() { return Boolean(bankTransfer.bank && bankTransfer.account && bankTransfer.holder); }
