import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { SubscriptionError } from "@/lib/subscriptions";

export class MembershipRequired extends Error {
  constructor() { super("membership-required"); }
}

export async function assertEncounterSubscription(
  encounterId: string, turn: number, visiting: boolean,
) {
  // This flag is enabled only in the subscription release, after the backend
  // and rules are deployed. It is not authorization; rules enforce access too.
  if (process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED !== "true") return;
  try {
    await httpsCallable(functions, "authorizePracticeEncounter")({ encounterId, turn, visiting });
  } catch (error) {
    if ((error as { code?: string }).code === "functions/permission-denied") {
      throw new MembershipRequired();
    }
    throw new SubscriptionError("unavailable");
  }
}
