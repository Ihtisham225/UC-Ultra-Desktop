import JobWorkScreen from "@/components/JobWorkScreen";

/**
 * Material out to the karigars who make the shawls. Same send-and-return
 * shape as job work, so it runs the same screen with a different kind.
 */
export default function Making() {
  return <JobWorkScreen kind="making" />;
}
