import { formatTantiemes } from "../../hooks/formatTantieme";

export function CoprosTab({ coproprietaires, votes }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-white">Liste des copropriétaires ({coproprietaires.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              {["Nom", "Prénom", "Email", "Tantièmes", "Présence", "Votes"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-zinc-500 dark:text-zinc-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {coproprietaires.map((c) => {
              const nbVotes = votes.filter((v) => v.coproprietaire_id === c.id).length;
              return (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">{c.nom}</td>
                  <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{c.prenom}</td>
                  <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">{c.email}</td>
                  <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 font-mono">{formatTantiemes(c.tantiemes)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${c.presence ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.presence ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-500"}`} />
                      {c.presence ? "Présent" : "Absent"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">{nbVotes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
