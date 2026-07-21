import { KinCueApp } from "./KinCueApp";
import { FirebaseAuthGate, FirebaseAuthProvider } from "./FirebaseAuth";
import { FamilySpaceGate, FamilySpaceProvider } from "./FamilySpace";

export default function Home() {
  return (
    <FirebaseAuthProvider>
      <FirebaseAuthGate>
        <FamilySpaceProvider>
          <FamilySpaceGate>
            <KinCueApp />
          </FamilySpaceGate>
        </FamilySpaceProvider>
      </FirebaseAuthGate>
    </FirebaseAuthProvider>
  );
}
