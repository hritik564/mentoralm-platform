export function useClerk() {
  return {
    async signOut() {
      document.documentElement.dataset.fixtureSignedOut = 'true';
    },
  };
}
