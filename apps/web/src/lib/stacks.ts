import { AppConfig, UserSession, showConnect } from "@stacks/connect";

const appConfig = new AppConfig(["store_write", "publish_data"]);
export const userSession = new UserSession({ appConfig });

export type StacksAuthState = {
  connected: boolean;
  stxAddress?: string;
};

export function getStacksAuthState(): StacksAuthState {
  const signedIn = userSession.isUserSignedIn();
  if (!signedIn) return { connected: false };
  const data = userSession.loadUserData();
  const stxAddress = data?.profile?.stxAddress?.mainnet || data?.profile?.stxAddress?.testnet;
  return { connected: true, stxAddress };
}

export async function connectLeather(): Promise<StacksAuthState> {
  if (userSession.isUserSignedIn()) return getStacksAuthState();

  await new Promise<void>((resolve, reject) => {
    showConnect({
      userSession,
      appDetails: {
        name: "Clova Pay",
        icon: "https://clova.cash/icon.png",
      },
      onFinish: () => resolve(),
      onCancel: () => reject(new Error("Wallet connection cancelled")),
    });
  });

  return getStacksAuthState();
}

export function disconnectLeather() {
  try {
    userSession.signUserOut();
  } catch {}
}
