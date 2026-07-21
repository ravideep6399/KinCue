import { FirebaseAuthGate, FirebaseAuthProvider } from "../../FirebaseAuth";
import { InviteAcceptance } from "./InviteAcceptance";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <FirebaseAuthProvider>
      <FirebaseAuthGate>
        <InviteAcceptance token={token} />
      </FirebaseAuthGate>
    </FirebaseAuthProvider>
  );
}
