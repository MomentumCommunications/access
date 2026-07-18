type AccountName = {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string | string[];
};

export function getAccountName(account: AccountName) {
  const fullName = [account.firstName, account.lastName]
    .filter(Boolean)
    .join(" ");
  const email = Array.isArray(account.email) ? account.email[0] : account.email;

  return fullName || account.name || email || "Unnamed";
}
