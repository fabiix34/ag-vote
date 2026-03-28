import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatTantiemes } from '../hooks/formatTantieme.js';

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 72,
    paddingHorizontal: 60,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#000',
    lineHeight: 1.5,
  },

  // ── EN-TÊTE
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  headerMeta: {
    fontSize: 10,
    textAlign: 'center',
  },

  // ── SECTION TITRE (PRÉSENTS EN SÉANCE, etc.)
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    paddingBottom: 3,
  },

  // ── PRÉSENTS
  presentsText: {
    fontSize: 9,
    marginBottom: 4,
    lineHeight: 1.6,
  },
  quorumLine: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
    marginBottom: 4,
  },

  // ── RÉSOLUTION BLOC
  resolutionBlock: {
    marginBottom: 28,
    marginTop: 16,
  },
  resolutionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    textDecoration: 'underline',
  },
  resolutionLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  resolutionDesc: {
    fontSize: 10,
    marginBottom: 8,
    lineHeight: 1.6,
  },
  annexeRow: {
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 3,
    marginLeft: 10,
  },
  montantRow: {
    fontSize: 9,
    marginBottom: 6,
  },
  participation: {
    fontSize: 9,
    marginBottom: 8,
    lineHeight: 1.5,
  },

  // ── TABLEAU DE VOTES
  voteTable: {
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  voteRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  voteTant: {
    fontSize: 10,
    width: 120,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  voteLabel: {
    fontSize: 10,
    width: 130,
    textAlign: 'center',
  },
  voteCount: {
    fontSize: 10,
    flex: 1,
    textAlign: 'left',
    fontFamily: 'Helvetica-Bold',
  },

  // ── RÉSULTAT
  resultLine: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },

  // ── LISTES NOMINATIVES
  voterBlock: {
    marginTop: 6,
    marginBottom: 4,
  },
  voterBlockTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 2,
  },
  voterList: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Oblique',
    lineHeight: 1.5,
    color: '#222',
    marginLeft: 10,
  },
  noVote: {
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
    marginTop: 4,
    color: '#444',
  },

  // ── SIGNATURES
  signatureSection: {
    marginTop: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  signatureBlock: { flex: 1, alignItems: 'center' },
  signatureSpace: { height: 44 },
  signatureLine: {
    borderTopWidth: 0.5,
    borderTopColor: '#000',
    width: '80%',
    marginBottom: 4,
  },
  signatureLabel: { fontSize: 9, textAlign: 'center' },

  // ── FOOTER FIXE
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: '#aaa',
  },
  footerText: { fontSize: 7, color: '#666' },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateFR(date) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function nomComplet(c) {
  return `${c.prenom} ${c.nom}`;
}

function formatFraction(a, b) {
  return `${formatTantiemes(a)} / ${formatTantiemes(b)}`;
}

// ─── Calcul votes pour une résolution ─────────────────────────────────────────
// Règle : coproprietaire présent sans vote = comptabilisé POUR

function calcVotes(resolution, votes, coproprietaires) {
  const presents = coproprietaires.filter(c => c.presence);
  const votesRes = votes.filter(v => v.resolution_id === resolution.id);

  const pourVotes = votesRes.filter(v => v.choix === 'pour');
  const contreVotes = votesRes.filter(v => v.choix === 'contre');
  const abstVotes = votesRes.filter(v => v.choix === 'abstention');

  const voterIds = new Set(votesRes.map(v => v.coproprietaire_id));
  const nonVoters = presents.filter(c => !voterIds.has(c.id));

  // Retrouver les objets copropriétaire depuis un vote
  const coprosById = Object.fromEntries(coproprietaires.map(c => [c.id, c]));

  const pourCopros = [
    ...pourVotes.map(v => coprosById[v.coproprietaire_id]).filter(Boolean),
    ...nonVoters,
  ];
  const contreCopros = contreVotes.map(v => coprosById[v.coproprietaire_id]).filter(Boolean);
  const abstCopros = abstVotes.map(v => coprosById[v.coproprietaire_id]).filter(Boolean);

  const tantPour = pourCopros.reduce((s, c) => s + (c.tantiemes || 0), 0);
  const tantContre = contreCopros.reduce((s, c) => s + (c.tantiemes || 0), 0);
  const tantAbst = abstCopros.reduce((s, c) => s + (c.tantiemes || 0), 0);

  // Dénominateurs (format PV officiel)
  const tantExprimes = tantPour + tantContre; // excl. abstentions
  const countExprimes = pourCopros.length + contreCopros.length;
  const tantPresents = tantPour + tantContre + tantAbst;
  const countPresents = presents.length;

  const adopte = tantPour > tantContre;

  return {
    pourCopros, contreCopros, abstCopros, nonVoters,
    tantPour, tantContre, tantAbst,
    tantExprimes, countExprimes,
    tantPresents, countPresents,
    adopte,
    hasVotes: votesRes.length > 0 || nonVoters.length > 0,
  };
}

// ─── Composant tableau de votes ───────────────────────────────────────────────

function VoteTable({ resolution, votes, coproprietaires }) {
  const d = calcVotes(resolution, votes, coproprietaires);
  const presents = coproprietaires.filter(c => c.presence);

  if (!d.hasVotes && presents.length === 0) {
    return <Text style={s.noVote}>Pas de vote enregistré pour cette résolution.</Text>;
  }

  const rows = [
    {
      tant: formatFraction(d.tantPour, d.tantExprimes),
      label: 'Votes POUR',
      count: `${d.pourCopros.length} / ${d.countExprimes}`,
    },
    {
      tant: formatFraction(d.tantContre, d.tantExprimes),
      label: 'Votes CONTRE',
      count: `${d.contreCopros.length} / ${d.countExprimes}`,
    },
    {
      tant: formatFraction(d.tantAbst, d.tantPresents),
      label: 'Votes ABSTENTION',
      count: `${d.abstCopros.length} / ${d.countPresents}`,
    },
  ];

  return (
    <View>
      <Text style={s.participation}>
        {'Ont participé au vote '}
        {d.countPresents}
        {' copropriétaire(s) présent(s), représentant '}
        {formatTantiemes(d.tantPresents)}
        {' tantièmes.'}
        {d.nonVoters.length > 0
          ? `\nDont ${d.nonVoters.length} copropriétaire(s) sans vote enregistré, comptabilisé(s) en faveur.`
          : ''}
      </Text>

      <Text style={{ fontSize: 9, marginBottom: 4 }}>
        Mise aux voix, cette résolution a donné lieu au vote suivant :
      </Text>

      <View style={s.voteTable}>
        {rows.map(row => (
          <View key={row.label} style={s.voteRow}>
            <Text style={s.voteTant}>{row.tant}</Text>
            <Text style={s.voteLabel}>{row.label}</Text>
            <Text style={s.voteCount}>{row.count}</Text>
          </View>
        ))}
      </View>

      {/* Résultat */}
      <Text style={s.resultLine}>
        {resolution.statut === 'termine'
          ? d.adopte
            ? 'Cette résolution est adoptée à la majorité art. 24'
            : 'Cette résolution est rejetée à la majorité art. 24'
          : resolution.statut === 'en_cours'
          ? 'Vote en cours — résultat provisoire'
          : 'Cette résolution n\'a pas encore fait l\'objet d\'un vote.'}
      </Text>

      {/* Listes nominatives */}
      {(resolution.statut === 'en_cours' || resolution.statut === 'termine') && (
        <View>
          {d.pourCopros.length > 0 && (
            <View style={s.voterBlock}>
              <Text style={s.voterBlockTitle}>
                {`Se sont exprimés en faveur (dont non-votants) : ${d.pourCopros.length} copropriétaire(s), totalisant ${formatTantiemes(d.tantPour)} tantièmes`}
              </Text>
              <Text style={s.voterList}>
                {d.pourCopros.map(nomComplet).join(', ')}
              </Text>
            </View>
          )}
          {d.contreCopros.length > 0 && (
            <View style={s.voterBlock}>
              <Text style={s.voterBlockTitle}>
                {`Se sont opposés à la majorité : ${d.contreCopros.length} copropriétaire(s), totalisant ${formatTantiemes(d.tantContre)} tantièmes`}
              </Text>
              <Text style={s.voterList}>
                {d.contreCopros.map(nomComplet).join(', ')}
              </Text>
            </View>
          )}
          {d.abstCopros.length > 0 && (
            <View style={s.voterBlock}>
              <Text style={s.voterBlockTitle}>
                {`Se sont abstenus : ${d.abstCopros.length} copropriétaire(s), totalisant ${formatTantiemes(d.tantAbst)} tantièmes`}
              </Text>
              <Text style={s.voterList}>
                {d.abstCopros.map(nomComplet).join(', ')}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Document principal ───────────────────────────────────────────────────────

export function PVDocument({ resolutions, votes, coproprietaires, documents }) {
  const today = new Date();
  const presents = coproprietaires.filter(c => c.presence);
  const totalTant = coproprietaires.reduce((a, c) => a + c.tantiemes, 0);
  const tantPresents = presents.reduce((a, c) => a + c.tantiemes, 0);

  return (
    <Document title={`PV AG — ${formatDateFR(today)}`} author="AG Copropriété">
      <Page size="A4" style={s.page}>

        {/* ── EN-TÊTE ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>PROCÈS VERBAL</Text>
          <Text style={s.headerSub}>ASSEMBLÉE GÉNÉRALE ORDINAIRE</Text>
          <Text style={s.headerMeta}>Séance du {formatDateFR(today)}</Text>
        </View>

        {/* ── PRÉSENTS ── */}
        <Text style={s.sectionTitle}>PRÉSENTS EN SÉANCE</Text>
        {presents.length === 0 ? (
          <Text style={s.presentsText}>Aucun copropriétaire enregistré comme présent.</Text>
        ) : (
          <Text style={s.presentsText}>
            {presents.map(c => `${nomComplet(c)} (${formatTantiemes(c.tantiemes)} tants.)`).join(' — ')}
          </Text>
        )}
        <Text style={s.quorumLine}>
          {`Sont présents : ${presents.length} copropriétaire(s) sur ${coproprietaires.length}, `}
          {`représentant ${formatTantiemes(tantPresents)} / ${formatTantiemes(totalTant)} tantièmes.`}
        </Text>

        {/* ── ORDRE DU JOUR ── */}
        <Text style={s.sectionTitle}>ORDRE DU JOUR</Text>
        {resolutions.map((r, idx) => (
          <Text key={r.id} style={{ fontSize: 10, marginBottom: 2, marginLeft: 8 }}>
            {`${idx + 1}.  ${r.titre}`}
          </Text>
        ))}

        {/* ── RÉSOLUTIONS ── */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>RÉSOLUTIONS</Text>
        {resolutions.map((r, idx) => {
          const resoDocs = documents?.[r.id] ?? [];
          const hasMontant = r.montant != null && r.montant !== -1;

          return (
            <View key={r.id} style={s.resolutionBlock}>
              {/* Titre */}
              <Text style={s.resolutionTitle}>
                {`${idx + 1}.  ${r.titre.toUpperCase()}`}
              </Text>

              {/* Corps */}
              {(r.description || hasMontant) && (
                <View>
                  <Text style={s.resolutionLabel}>Résolution :</Text>
                  {r.description ? (
                    <Text style={s.resolutionDesc}>{r.description}</Text>
                  ) : null}
                  {hasMontant && (
                    <Text style={s.montantRow}>
                      {'Montant : '}
                      <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                        {r.montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </Text>
                    </Text>
                  )}
                </View>
              )}

              {/* Annexes */}
              {resoDocs.map((doc, di) => (
                <Text key={di} style={s.annexeRow}>
                  {'P.J. : ' + doc.nom}
                </Text>
              ))}

              {/* Vote */}
              <VoteTable
                resolution={r}
                votes={votes}
                coproprietaires={coproprietaires}
              />
            </View>
          );
        })}

        {/* ── SIGNATURES ── */}
        <View style={s.signatureSection}>
          {['Le Président de séance', 'Le Scrutateur', 'Le Secrétaire de séance'].map(role => (
            <View key={role} style={s.signatureBlock}>
              <View style={s.signatureSpace} />
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>{role}</Text>
            </View>
          ))}
        </View>

        {/* ── FOOTER FIXE ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>PV AG — {formatDateFR(today)}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
