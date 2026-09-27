const {
  getMerchantRules,
  upsertMerchantRule,
  deleteMerchantRule,
  importMerchantRules,
} = require("../controllers/merchantRuleController");
const auth = require("../middleware/auth");
const { validateBody, validateParams } = require("../middleware/validation");
const {
  merchantRuleKeyParamSchema,
  merchantRuleBodySchema,
  merchantRuleImportSchema,
} = require("../middleware/validation/schemas");

const express = require("express");
const router = express.Router();

// All routes require authentication
router.use(auth);

router.get("/", getMerchantRules);
router.put("/:key", validateParams(merchantRuleKeyParamSchema), validateBody(merchantRuleBodySchema), upsertMerchantRule);
router.delete("/:key", validateParams(merchantRuleKeyParamSchema), deleteMerchantRule);
router.post("/import", validateBody(merchantRuleImportSchema), importMerchantRules);

module.exports = router;
