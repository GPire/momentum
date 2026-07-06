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
export function createNexusMeshMind(orchestrator, vaultDAO) {
  return {
    get validationSet() { return orchestrator._validationSet || []; },
    model: {
      serialize: () => ({
        format: 'nexus-v1',
        net: vaultDAO.state.mlData.neuralNet,
        trainedExamples: vaultDAO.state.mlData.totalWords || 1,
      }),
      get trainedExamples() { return vaultDAO.state.mlData.totalWords || 1; },
    },
    store: { save: async () => vaultDAO.save() },
    mergeRemote(weights) {
      if (!weights || weights.format !== 'nexus-v1' || !weights.net) {
        return { accepted: false, reason: 'formato sconosciuto' };
      }
      if (!vaultDAO.state.mlData.neuralNet) {
        // Dispositivo nuovo: nessuna rete locale da fondere → ADOTTA quella
        // del peer fidato. È il valore del pairing: il secondo dispositivo
        // nasce già addestrato invece di ripartire da zero.
        vaultDAO.state.mlData.neuralNet = weights.net;
        vaultDAO.state.mlData.totalWords = weights.trainedExamples || 1;
        vaultDAO.save();
        return { accepted: true, adopted: true, totalExamples: weights.trainedExamples || 1 };
      }
      return orchestrator.mergeRemoteNeuralNet(weights.net, weights.trainedExamples || 1);
    },
  };
}
