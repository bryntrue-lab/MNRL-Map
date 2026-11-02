const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");

function harness() {
  const auth = {currentUser:{uid:"alice"}};
  const calls = [];
  let identity;
  let purchaseError;
  let active = true;
  let period = "P1M";
  let serverPractice;
  const sdk = {
    isConfigured:async()=>Boolean(identity),
    configure:({appUserID})=>{identity=appUserID;calls.push(["configure",appUserID]);},
    getAppUserID:async()=>identity,
    logIn:async uid=>{identity=uid;calls.push(["login",uid]);},
    isAnonymous:async()=>false,
    logOut:async()=>{identity=undefined;calls.push(["logout"]);},
    getOfferings:async()=>({current:{
      annual:{product:{identifier:"MNRL108",subscriptionPeriod:"P1Y",priceString:"$107.99"}},
      monthly:{product:{identifier:"MNRL8",subscriptionPeriod:period,priceString:"$12.99"}},
      lifetime:{product:{identifier:"lifetime"}},
    }}),
    purchasePackage:async p=>{calls.push(["purchase",identity,p.product.identifier]);if(purchaseError)throw purchaseError;},
    restorePurchases:async()=>({entitlements:{active:active?{mineral_a_creative_practice_pro:{}}:{}}}),
    showManageSubscriptions:async()=>{calls.push(["manage"]);},
    presentCodeRedemptionSheet:async()=>{calls.push(["redeem"]);},
  };
  const exports = {};
  const source=fs.readFileSync(path.join(__dirname,"../lib/subscriptions.ts"),"utf8");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{
    exports,process:{env:{EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:"appl_unit_test"}},
    setTimeout:resolve=>{resolve();},console,
    require(id){
      if(id==="react-native")return {Platform:{OS:"ios"}};
      if(id==="@/lib/firebase")return {auth,functions:{}};
      if(id==="react-native-purchases")return {default:sdk};
      if(id==="firebase/functions")return {httpsCallable:()=>async()=>{
        calls.push(["verify",auth.currentUser?.uid]);
        return {data:{practice:serverPractice??active,membershipStatus:active?"member":"free",membershipExpiresAt:null,membershipSince:null,membershipProductId:null}};
      }};
      throw Error(`Unexpected import: ${id}`);
    },
  });
  return {api:exports,auth,calls,setServer:v=>serverPractice=v,setActive:v=>active=v,setPeriod:v=>period=v,setError:v=>purchaseError=v};
}
test("offering uses real Apple packages and localized prices, excluding lifetime",async()=>{
  const h=harness();const plans=await h.api.loadSubscriptionPlans("alice");
  assert.deepEqual(Object.keys(plans),["annual","monthly"]);
  assert.equal(plans.annual.product.priceString,"$107.99");
  h.setPeriod("P1Y");
  await assert.rejects(h.api.loadSubscriptionPlans("alice"),e=>e.code==="invalid-offering");
});
test("purchase unlocks only after server verification",async()=>{
  const h=harness();const plans=await h.api.loadSubscriptionPlans("alice");
  await h.api.purchaseSubscription("alice",plans.annual);
  assert.deepEqual(h.calls.slice(-2),[["purchase","alice","MNRL108"],["verify","alice"]]);
});
test("cancelled purchase does not call verification",async()=>{
  const h=harness();const plans=await h.api.loadSubscriptionPlans("alice");
  h.setError({userCancelled:true});
  await assert.rejects(h.api.purchaseSubscription("alice",plans.monthly),e=>e.userCancelled);
  assert.equal(h.calls.some(c=>c[0]==="verify"),false);
});
test("StoreKit pending purchase is not reported as failed payment",async()=>{
  const h=harness();const plans=await h.api.loadSubscriptionPlans("alice");
  h.setError({code:"20"});
  await assert.rejects(h.api.purchaseSubscription("alice",plans.annual),e=>e.code==="pending");
});
test("delayed entitlement stays pending and can be restored",async()=>{
  const h=harness();const plans=await h.api.loadSubscriptionPlans("alice");
  h.setActive(false);
  await assert.rejects(h.api.purchaseSubscription("alice",plans.annual),e=>e.code==="pending");
  h.setActive(true);
  assert.equal((await h.api.restoreSubscription("alice")).practice,true);
});
test("restoring an empty account returns free, not a success",async()=>{
  const h=harness();h.setActive(false);
  assert.equal((await h.api.restoreSubscription("alice")).practice,false);
});
test("identity switch rejects stale operations and reidentifies SDK",async()=>{
  const h=harness();await h.api.loadSubscriptionPlans("alice");
  h.auth.currentUser={uid:"bob"};
  await assert.rejects(h.api.restoreSubscription("alice"),e=>e.code==="identity-changed");
  await h.api.loadSubscriptionPlans("bob");
  assert.ok(h.calls.some(c=>c[0]==="login"&&c[1]==="bob"));
});
test("signout clears SDK identity",async()=>{
  const h=harness();await h.api.loadSubscriptionPlans("alice");
  await h.api.clearSubscriptionIdentity();
  assert.ok(h.calls.some(c=>c[0]==="logout"));
});
test("SDK entitlement never grants: server practice=false wins over active SDK",async()=>{
  const h=harness();h.setActive(true);h.setServer(false);
  await assert.rejects(h.api.restoreSubscription("alice"),e=>e.code==="pending");
});
test("offer code redemption refreshes the server",async()=>{
  const h=harness();
  const access=await h.api.redeemSubscriptionCode("alice");
  assert.deepEqual(h.calls.slice(-2),[["redeem"],["verify","alice"]]);
  assert.equal(access.practice,true);
});
