import test from 'node:test';
import assert from 'node:assert/strict';
import { orderBenefits } from '../assets/order-summary.js';
import { variantChoices, replaceCartOption } from '../assets/cart-options.js';

test('shipping progress and payable amount share the real 70,000 threshold',()=>{
 assert.deepEqual([69999,70000].map(unitPrice=>{const s=orderBenefits([{unitPrice,quantity:1}]);return [s.shippingFee,s.total,s.remaining];}),[[3500,73499,1],[0,70000,0]]);
 assert.equal(orderBenefits([]).total,0);assert.equal(orderBenefits([]).shippingFee,0);
});
test('campaign savings are informational and coupons are deducted once',()=>{
 const rows=[{unitPrice:49000,regularPrice:94000,quantity:2,campaign:true},{unitPrice:39000,regularPrice:76000,quantity:1,campaign:true},{unitPrice:75800,quantity:1}];
 const s=orderBenefits(rows);assert.equal(s.subtotal,212800);assert.equal(s.campaignSavings,127000);assert.equal(s.total,212800);
 const coupon=orderBenefits([{unitPrice:60000,quantity:1}],{discountAmount:6000,shippingFee:3500});assert.equal(coupon.totalSavings,6000);assert.equal(coupon.total,57500);assert.equal(coupon.remaining,10000);
 assert.equal(orderBenefits([{unitPrice:39000,regularPrice:59000,quantity:1}]).campaignSavings,0);
});
const offerId='eb3ff32a-dce8-4c79-8dba-c93058eb6247';
const products=[{id:'blue',model:'No.1027',name:'No.1027 블루',price:59000,stock:4,options:[]},{id:'pink',model:'No.1027',name:'No.1027 핑크',price:61000,stock:3,options:[]},{id:'other',model:'No.0422',price:76000,stock:5},{id:'option',model:'No.1027',name:'No.1027 선택형',price:60000,options:[{id:'mint',label:'민트',stock:2},{id:'sold',label:'품절색',stock:0}]}];
const source={id:'blue',name:'블루',price:59000,q:2,optionId:'',stock:4};
const event={state:'open',endsAt:'2099-01-01T00:00:00Z',items:[{productId:'pink',optionId:'',offerId,price:39000,regularPrice:61000,remaining:3}]};
test('variant choices use the same model and real option stock',()=>{
 const choices=variantChoices(source,products,event);assert.equal(choices.length,4);assert.equal(choices.some(c=>c.id==='other'),false);
 assert.equal(choices.find(c=>c.optionId==='sold').disabled,true);assert.equal(choices.find(c=>c.id==='pink').price,61000);
 assert.equal(choices.find(c=>c.optionId==='mint').stock,2);
});
test('campaign changes only expose verified live offers and never silently fall back to retail',()=>{
 const sale={...source,price:39000,blackFriday:{offerId,unitPrice:39000}};
 const choices=variantChoices(sale,products,event);const pink=choices.find(c=>c.id==='pink');assert.equal(pink.price,39000);assert.equal(pink.blackFriday.offerId,offerId);
 assert.equal(choices.find(c=>c.id==='blue').disabled,true);
 assert.equal(variantChoices(sale,products,{...event,state:'closed'}).every(c=>c.disabled),true);
});
test('option changes keep quantity and merge identical purchase contexts without altering the input',()=>{
 const pink=variantChoices(source,products,event).find(c=>c.id==='pink');const cart=[source,{...pink,q:1}];const before=JSON.stringify(cart);
 const changed=replaceCartOption(cart,0,pink);assert.equal(changed.length,1);assert.equal(changed[0].q,3);assert.equal(changed[0].price,61000);assert.equal(JSON.stringify(cart),before);
 const same=replaceCartOption([source],0,variantChoices(source,products,event).find(c=>c.id==='blue'));assert.equal(same[0].q,2);
});
test('quota shortage and different purchase conditions reject the entire option change',()=>{
 const pink=variantChoices(source,products,event).find(c=>c.id==='pink');const cart=[source,{...pink,q:2}];const before=JSON.stringify(cart);assert.throws(()=>replaceCartOption(cart,0,pink));assert.equal(JSON.stringify(cart),before);
 assert.throws(()=>replaceCartOption([source,{...pink,q:1,blackFriday:{offerId,unitPrice:39000}}],0,pink));
});
test('changing to an excluded existing colour never enrolls its quantities into selected checkout',()=>{
 const pink=variantChoices(source,products,event).find(c=>c.id==='pink');const cart=[{...source,q:1},{...pink,q:2}];const before=JSON.stringify(cart);
 assert.throws(()=>replaceCartOption(cart,0,pink,{isSelected:item=>item.id==='blue'}),/선택/);
 assert.equal(JSON.stringify(cart),before);
});
