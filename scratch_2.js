// Test with a reliable public API first
const response = await fetch("https://api.squiggle.com.au/?q=games;year=2026");
const data = await response.json();
console.log(data);
