import { getProfile, getQualificationMasters } from "@/lib/actions/profile";
import { EditProfileClient } from "./edit-client";

export default async function EditProfilePage() {
  const [profile, qualMasters] = await Promise.all([
    getProfile(),
    getQualificationMasters(),
  ]);

  return <EditProfileClient initialProfile={profile} initialQualMasters={qualMasters} />;
}
