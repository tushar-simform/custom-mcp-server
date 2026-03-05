// Add two numbers
function add(a, b) {
  return a + b;
}

// Subtract two numbers
function subtract(a, b) {
  return a - b;
}

//multiply two numbers
function multiply(a, b) {
  return a * b;
}

//divide two numbers
function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}

// unused commented code
// function power(a, b) {
//   return Math.pow(a, b);
// }

// Export the functions as a module
module.exports = {
  add,
  subtract,
  multiply,
  divide,
};
