import { downloadFile } from "../api";

export const pvService = {
  generate: ({ resolutions, votes, coproprietaires }) => {
    const filename = `PV_AG_${new Date().toISOString().slice(0, 10)}.docx`;
    return downloadFile("/pv/generate", { resolutions, votes, coproprietaires }, filename);
  },
};
