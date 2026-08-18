export function isExplicitlyDataLess(branch) {
  return branch !== null &&
    typeof branch === "object" &&
    Object.hasOwn(branch, "with_data") &&
    typeof branch.with_data === "boolean" &&
    branch.with_data === false;
}

export function selectExactBranchByName(branches, expectedName) {
  if (!Array.isArray(branches) || typeof expectedName !== "string") {
    throw new TypeError("Branch selection requires an array and an exact name");
  }

  const matches = branches.filter((branch) =>
    branch !== null &&
    typeof branch === "object" &&
    Object.hasOwn(branch, "name") &&
    branch.name === expectedName
  );
  if (matches.length !== 1) {
    throw new Error("Expected exactly one branch with the exact name");
  }
  return matches[0];
}
