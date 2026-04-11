/**
 * Génération du Procès-Verbal en DOCX côté serveur.
 * Adapté de src/PVGenerator/PVDocx.js — sans dépendance au DOM.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import { documentService } from "./db.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTantiemes = (n) => n?.toLocaleString("fr-FR") ?? "0";

function formatDateFR(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function nomComplet(c) {
  return `${c.prenom} ${c.nom}`;
}

function formatFraction(a, b) {
  return `${formatTantiemes(a)} / ${formatTantiemes(b)}`;
}

// ─── Calcul votes ─────────────────────────────────────────────────────────────

function calcVotes(resolution, votes, coproprietaires) {
  const presents  = coproprietaires.filter((c) => c.presence);
  const votesRes  = votes.filter((v) => v.resolution_id === resolution.id);

  const pourVotes   = votesRes.filter((v) => v.choix === "pour");
  const contreVotes = votesRes.filter((v) => v.choix === "contre");
  const abstVotes   = votesRes.filter((v) => v.choix === "abstention");

  const voterIds  = new Set(votesRes.map((v) => v.coproprietaire_id));
  const nonVoters = presents.filter((c) => !voterIds.has(c.id));
  const coprosById = Object.fromEntries(coproprietaires.map((c) => [c.id, c]));

  const pourCopros   = [
    ...pourVotes.map((v) => coprosById[v.coproprietaire_id]).filter(Boolean),
    ...nonVoters,
  ];
  const contreCopros = contreVotes.map((v) => coprosById[v.coproprietaire_id]).filter(Boolean);
  const abstCopros   = abstVotes.map((v) => coprosById[v.coproprietaire_id]).filter(Boolean);

  const tantPour    = pourCopros.reduce((s, c) => s + (c.tantiemes || 0), 0);
  const tantContre  = contreCopros.reduce((s, c) => s + (c.tantiemes || 0), 0);
  const tantAbst    = abstCopros.reduce((s, c) => s + (c.tantiemes || 0), 0);
  const tantExprimes  = tantPour + tantContre;
  const countExprimes = pourCopros.length + contreCopros.length;
  const tantPresents  = tantPour + tantContre + tantAbst;

  return {
    pourCopros, contreCopros, abstCopros, nonVoters,
    tantPour, tantContre, tantAbst,
    tantExprimes, countExprimes,
    tantPresents, countPresents: presents.length,
    adopte:   tantPour > tantContre,
    hasVotes: votesRes.length > 0 || nonVoters.length > 0,
  };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const CELL_NO_BORDERS = {
  top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER,
};
const TABLE_NO_BORDERS = { ...CELL_NO_BORDERS, insideH: NONE_BORDER, insideV: NONE_BORDER };

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 400, after: 140 },
    border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 } },
  });
}

function spacer(twips = 200) {
  return new Paragraph({ text: "", spacing: { after: twips } });
}

// ─── Section vote d'une résolution ───────────────────────────────────────────

function buildVoteSection(resolution, votes, coproprietaires) {
  const d = calcVotes(resolution, votes, coproprietaires);
  const presents = coproprietaires.filter((c) => c.presence);
  const items = [];

  if (!d.hasVotes && presents.length === 0) {
    items.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Pas de vote enregistré pour cette résolution.",
            italics: true,
            size: 18,
          }),
        ],
      })
    );
    return items;
  }

  let participationText = `Ont participé au vote ${d.countPresents} copropriétaire(s) présent(s), représentant ${formatTantiemes(d.tantPresents)} tantièmes.`;
  if (d.nonVoters.length > 0) {
    participationText += ` Dont ${d.nonVoters.length} copropriétaire(s) sans vote enregistré, comptabilisé(s) en faveur.`;
  }
  items.push(
    new Paragraph({
      children: [new TextRun({ text: participationText, size: 18 })],
      spacing: { after: 120 },
    })
  );

  items.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Mise aux voix, cette résolution a donné lieu au vote suivant :",
          size: 18,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  const voteRows = [
    {
      tant: formatFraction(d.tantPour, d.tantExprimes),
      label: "Votes POUR",
      count: `${d.pourCopros.length} / ${d.countExprimes}`,
    },
    {
      tant: formatFraction(d.tantContre, d.tantExprimes),
      label: "Votes CONTRE",
      count: `${d.contreCopros.length} / ${d.countExprimes}`,
    },
    {
      tant: formatFraction(d.tantAbst, d.tantPresents),
      label: "Votes ABSTENTION",
      count: `${d.abstCopros.length} / ${d.countPresents}`,
    },
  ];

  items.push(
    new Table({
      rows: voteRows.map(
        (row) =>
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: row.tant, bold: true, size: 18 })],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
                width: { size: 32, type: WidthType.PERCENTAGE },
                borders: CELL_NO_BORDERS,
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: row.label, size: 18 })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                width: { size: 36, type: WidthType.PERCENTAGE },
                borders: CELL_NO_BORDERS,
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: row.count, bold: true, size: 18 })],
                    alignment: AlignmentType.LEFT,
                  }),
                ],
                width: { size: 32, type: WidthType.PERCENTAGE },
                borders: CELL_NO_BORDERS,
              }),
            ],
          })
      ),
      width: { size: 80, type: WidthType.PERCENTAGE },
      borders: TABLE_NO_BORDERS,
    })
  );

  let resultText;
  if (resolution.statut === "termine") {
    resultText = d.adopte
      ? "Cette résolution est adoptée à la majorité art. 24"
      : "Cette résolution est rejetée à la majorité art. 24";
  } else if (resolution.statut === "en_cours") {
    resultText = "Vote en cours — résultat provisoire";
  } else {
    resultText = "Cette résolution n'a pas encore fait l'objet d'un vote.";
  }

  items.push(
    new Paragraph({
      children: [new TextRun({ text: resultText, bold: true, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    })
  );

  if (resolution.statut === "en_cours" || resolution.statut === "termine") {
    const voterGroups = [
      {
        copros: d.pourCopros,
        tant: d.tantPour,
        label: "Se sont exprimés en faveur (dont non-votants)",
      },
      { copros: d.contreCopros, tant: d.tantContre, label: "Se sont opposés à la majorité" },
      { copros: d.abstCopros, tant: d.tantAbst, label: "Se sont abstenus" },
    ];

    for (const { copros, tant, label } of voterGroups) {
      if (copros.length === 0) continue;
      items.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${label} : ${copros.length} copropriétaire(s), totalisant ${formatTantiemes(tant)} tantièmes`,
              italics: true,
              size: 18,
            }),
          ],
          spacing: { after: 60 },
        })
      );
      items.push(
        new Paragraph({
          children: [
            new TextRun({ text: copros.map(nomComplet).join(", "), italics: true, size: 17 }),
          ],
          indent: { left: 720 },
          spacing: { after: 120 },
        })
      );
    }
  }

  return items;
}

// ─── Fetch annexes depuis Supabase Storage ────────────────────────────────────

async function fetchDocuments(resolutionIds) {
  if (resolutionIds.length === 0) return {};

  const { data } = await documentService.fetchByResolutions(resolutionIds);
  if (!data?.length) return {};

  const { data: signed } = await documentService.getSignedUrls(
    data.map((d) => d.path),
    3600
  );

  const withUrls = data.map((doc, i) => ({
    ...doc,
    signedUrl: signed?.[i]?.signedUrl ?? null,
  }));

  return withUrls.reduce((acc, doc) => {
    if (!acc[doc.resolution_id]) acc[doc.resolution_id] = [];
    acc[doc.resolution_id].push(doc);
    return acc;
  }, {});
}

// ─── Génération principale ────────────────────────────────────────────────────

/**
 * Génère le PV en DOCX et retourne un Buffer.
 *
 * @param {{ resolutions, votes, coproprietaires }} payload
 * @returns {Promise<Buffer>}
 */
export async function generatePVBuffer({ resolutions, votes, coproprietaires }) {
  const documents = await fetchDocuments(resolutions.map((r) => r.id));

  const today       = new Date();
  const presents    = coproprietaires.filter((c) => c.presence);
  const totalTant   = coproprietaires.reduce((a, c) => a + c.tantiemes, 0);
  const tantPresents = presents.reduce((a, c) => a + c.tantiemes, 0);

  const children = [];

  // ── EN-TÊTE ──
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "PROCÈS VERBAL", bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "ASSEMBLÉE GÉNÉRALE ORDINAIRE", bold: true, size: 24 }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Séance du ${formatDateFR(today)}`, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      border: {
        bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 },
      },
    })
  );

  // ── PRÉSENTS ──
  children.push(sectionTitle("PRÉSENTS EN SÉANCE"));
  if (presents.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Aucun copropriétaire enregistré comme présent.",
            size: 18,
          }),
        ],
      })
    );
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: presents
              .map((c) => `${nomComplet(c)} (${formatTantiemes(c.tantiemes)} tants.)`)
              .join(" — "),
            size: 18,
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Sont présents : ${presents.length} copropriétaire(s) sur ${coproprietaires.length}, représentant ${formatTantiemes(tantPresents)} / ${formatTantiemes(totalTant)} tantièmes.`,
          bold: true,
          size: 18,
        }),
      ],
      spacing: { after: 160 },
    })
  );

  // ── ORDRE DU JOUR ──
  children.push(sectionTitle("ORDRE DU JOUR"));
  for (const [idx, r] of resolutions.entries()) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${idx + 1}.  ${r.titre}`, size: 20 })],
        spacing: { after: 80 },
        indent: { left: 360 },
      })
    );
  }

  // ── RÉSOLUTIONS ──
  children.push(sectionTitle("RÉSOLUTIONS"));
  for (const [idx, r] of resolutions.entries()) {
    const resoDocs  = documents?.[r.id] ?? [];
    const hasMontant = r.montant != null && r.montant !== -1;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${idx + 1}.  ${r.titre.toUpperCase()}`,
            bold: true,
            underline: {},
            size: 22,
          }),
        ],
        spacing: { before: 360, after: 160 },
      })
    );

    if (r.description) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "Résolution :", bold: true, size: 20 })],
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [new TextRun({ text: r.description, size: 20 })],
          spacing: { after: 160 },
        })
      );
    }

    if (hasMontant) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Montant : ", size: 18 }),
            new TextRun({
              text: r.montant.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
              }),
              bold: true,
              size: 18,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    for (const doc of resoDocs) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `P.J. : ${doc.nom}`, italics: true, size: 17 })],
          indent: { left: 200 },
          spacing: { after: 60 },
        })
      );
    }

    children.push(...buildVoteSection(r, votes, coproprietaires));
  }

  // ── SIGNATURES ──
  const roles = ["Le Président de séance", "Le Scrutateur", "Le Secrétaire de séance"];
  children.push(
    spacer(1120),
    new Table({
      rows: [
        new TableRow({
          children: roles.map(
            () =>
              new TableCell({
                children: [spacer(880)],
                borders: CELL_NO_BORDERS,
                width: { size: 33, type: WidthType.PERCENTAGE },
              })
          ),
        }),
        new TableRow({
          children: roles.map(
            (role) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: role, size: 18 })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                borders: {
                  top: {
                    color: "000000",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6,
                  },
                  ...CELL_NO_BORDERS,
                },
                width: { size: 33, type: WidthType.PERCENTAGE },
              })
          ),
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_NO_BORDERS,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left:   convertMillimetersToTwip(25),
              right:  convertMillimetersToTwip(25),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
