// Ponte tra il MeshNode (protocollo federato P2P) e il VERO stato neurale
// della webapp (VaultDAO.state.mlData.neuralNet via l'orchestratore).
//
// PERCHÉ ESISTE: MeshNode nasceva per il motore standalone (RealMind) e il
// suo merge scriveva su quella copia — che nella webapp è morta: la rete
// che impara davvero dall'uso è NeuralNexus. Senza questo adapter la mesh
// "funzionava" ma sincronizzava pesi che nessuno usava. Ora:
// - in uscita: serialize() legge la rete vera (formato dichiarato nexus-v1);
// - in entrata: mergeRemote() delega a orchestrator.mergeRemoteNeuralNet,
//   che fa FedAvg pesato sul conteggio esempi + controllo anti-poisoning
//   sulla validation set reale, e salva nel vault.
// Pesi in formato diverso/sconosciuto vengono rifiutati, mai indovinati.
//
// STESSO payload porta anche il grafo DCGN (opzionale, campo `graph`):
// dcgn.js aveva già una federazione a competenza pronta
// (mergeExpertWeighted) ma nessun punto del codice la collegava alla mesh —
// il grafo che impara online da ogni transazione confermata restava chiuso
// sul singolo dispositivo. Un peer di formato più vecchio semplicemente non
// manda `graph`: skip silenzioso, mai un crash.
export function createNexusMeshMind(orchestrator, vaultDAO) {
  return {
    get validationSet() { return orchestrator._validationSet || []; },
    model: {
      serialize: () => ({
        format: 'nexus-v1',
        net: vaultDAO.state.mlData.neuralNet,
        trainedExamples: vaultDAO.state.mlData.totalWords || 1,
        // Conteggi PER categoria (mlData.catCounts, già tracciati per il
        // Naive Bayes) — permettono al merge di pesare ogni categoria in
        // base a chi l'ha vista di più, non solo al totale del dispositivo
        // (vedi fondiOutputPerNome in neural-nexus.js). Opzionale: un peer
        // con un formato più vecchio semplicemente non li manda, e il
        // merge ricade sul peso globale, invariato.
        catCounts: vaultDAO.state.mlData.catCounts || {},
        // Grafo DCGN (src/graph/dcgn.js) — null se il dispositivo non l'ha
        // ancora popolato (nessuna transazione confermata).
        graph: vaultDAO.state.mlData.dcgn || null,
      }),
      get trainedExamples() { return vaultDAO.state.mlData.totalWords || 1; },
    },
    store: { save: async () => vaultDAO.save() },
    mergeRemote(weights) {
      if (!weights || weights.format !== 'nexus-v1' || !weights.net) {
        return { accepted: false, reason: 'formato sconosciuto' };
      }
      let risultato;
      if (!vaultDAO.state.mlData.neuralNet) {
        // Dispositivo nuovo: nessuna rete locale da fondere → ADOTTA quella
        // del peer fidato. È il valore del pairing: il secondo dispositivo
        // nasce già addestrato invece di ripartire da zero.
        vaultDAO.state.mlData.neuralNet = weights.net;
        vaultDAO.state.mlData.totalWords = weights.trainedExamples || 1;
        vaultDAO.save();
        risultato = { accepted: true, adopted: true, totalExamples: weights.trainedExamples || 1 };
      } else {
        risultato = orchestrator.mergeRemoteNeuralNet(weights.net, weights.trainedExamples || 1, weights.catCounts || null);
      }

      // Il grafo DCGN è un canale INDIPENDENTE dalla rete: il suo esito
      // (accettato/rifiutato/adottato) non deve mai alterare quello della
      // rete neurale sopra, per questo vive annidato in `risultato.graph`.
      if (weights.graph) {
        const graphLocale = vaultDAO.state.mlData.dcgn;
        if (!graphLocale || !graphLocale.docs) {
          vaultDAO.state.mlData.dcgn = weights.graph;
          orchestrator.graph = weights.graph;
          vaultDAO.save();
          risultato.graph = { accepted: true, adopted: true };
        } else {
          risultato.graph = orchestrator.mergeRemoteGraph(weights.graph);
        }
      }

      return risultato;
    },
  };
}
