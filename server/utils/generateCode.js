/**
 * Generates a 6-digit numeric join code (as a string), e.g. "482913",
 * skipping any code already in use by an active session.
 */
function generateCode(isCodeTaken) {
  let code;
  let attempts = 0;

  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
    attempts += 1;
  } while (isCodeTaken(code) && attempts < 50);

  return code;
}

module.exports = generateCode;
