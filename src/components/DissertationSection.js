import React from 'react';

const DissertationSection = ({ onOpenDashboard }) => (
  <section
    id="dissertation"
    className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden"
  >
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">
        Master’s Dissertation
      </h2>

      {/* Project Overview */}
      <h3 className="text-xl font-semibold text-gray-200 mb-2">
        Using Machine Learning to Identify Black Hole Subsystems in Globular Clusters
      </h3>
      <p className="text-gray-400 leading-relaxed mb-6">
        This project investigates how machine learning can be used to identify globular clusters
        that host stellar-mass black hole subsystems, addressing the discrepancy between theoretical
        predictions and the limited number of confirmed observational detections. Rather than relying
        on direct electromagnetic signatures, the work focuses on learning indirect dynamical and
        structural indicators derived from realistic star cluster simulations - and critically, on
        whether classifiers trained across physically distinct simulation frameworks can generalise
        robustly to real observational data.
      </p>

      {/* Methodology */}
      <h4 className="text-lg font-semibold text-gray-300 mb-2">
        Methodology & Technical Approach
      </h4>
      <p className="text-gray-400 leading-relaxed mb-4">
        The project combines large-scale astrophysical simulations with supervised ensemble machine
        learning. Training data are drawn from two complementary simulation frameworks: MOCCA (a
        Monte Carlo code) as the primary source, providing 1,296 labelled snapshots, and RAPSTER
        (a semi-analytic rapid cluster evolution code), contributing a further 11,264 snapshots to
        form a combined pool of 12,560 simulations. Simulation outputs are transformed into eight
        observable cluster-scale features - central surface brightness, central velocity dispersion,
        total V-band luminosity, median relaxation time, half-light radius, core radius, and two
        derived structural ratios (`r_c/r_hl` and `L_tot/r^2_hl`) - mirroring quantities accessible
        in real astronomical surveys. The final feature contract was determined through a
        leave-one-feature-out ablation study optimising cross-framework transfer.
      </p>
      <p className="text-gray-400 leading-relaxed mb-6">
        A stacked generalisation ensemble is trained on this mixed-code pool, combining three base
        learners with complementary inductive biases - CatBoost, XGBoost, and a residual multilayer
        perceptron - whose out-of-fold probability predictions are combined by a logistic regression
        meta-learner. Class imbalance is handled through source-balanced sample weighting rather than
        synthetic oversampling, which was ruled out because MOCCA and RAPSTER remain near-perfectly
        separable in feature space (`domain classifier AUC = 0.9993`). Cross-framework domain shift
        is addressed through per-source feature standardisation, physically motivated proxy
        alignment, and a calibrated RAPSTER label threshold (`N_BH >= 50`) matched to MOCCA's
        positive-class rate.
      </p>

      <h4 className="text-lg font-semibold text-gray-300 mb-2">
        Results & Achievements
      </h4>
      <p className="text-gray-400 leading-relaxed mb-4">
        The Mixed Stacking Ensemble achieves a cross-framework harmonic-mean F1 of 0.804 on held-out
        validation data, compared with 0.279 for a MOCCA-only baseline - a 2.88x improvement in
        cross-code generalisation. The best single model under cross-validation, Mixed CatBoost,
        reaches `F1 = 0.871 +/- 0.025`, exceeding the Askar et al. (2019) benchmark of `F1 = 0.857`.
        All three DRAGON direct N-body simulations withheld from training are correctly classified as
        BHS-positive (`mean predicted probability 0.860`), providing qualitative cross-code
        validation to a third independent simulation architecture.
      </p>
      <p className="text-gray-400 leading-relaxed mb-6">
        Applied to three real observational catalogues, the deployment model identifies 24
        BHS-positive candidates in the Harris catalogue (48.4% literature recall, 62.5% precision),
        25 in the Baumgardt-Hilker catalogue (68.0% recall and precision), and 41 from 167 clusters
        in the Holger Baumgardt N-body catalogue (54.8% recall). Palomar 5 is documented as a
        principled domain-gap failure: its core radius lies 13.65 standard deviations beyond the
        training mean, and its morphology - produced by over 11 Gyr of black-hole-driven tidal
        disruption - is structurally indistinguishable from BHS-negative systems within the current
        feature contract.
      </p>

      {/* Motivation & Novelty */}
      <h4 className="text-lg font-semibold text-gray-300 mb-2">
        Research Motivation & Novelty
      </h4>
      <p className="text-gray-400 leading-relaxed mb-6">
        Black holes in globular clusters are difficult to detect because most are non-accreting and
        electromagnetically quiet, and clusters with similar observable properties can evolve through
        very different dynamical pathways. This project extends the methodology of Askar et al.
        (2019) by introducing a mixed-code training regime that explicitly confronts domain shift -
        the tendency of single-framework classifiers to learn code-specific artefacts rather than
        genuine physical relationships. The cross-framework harmonic-mean F1 objective,
        source-balanced evaluation protocol, and structured ablation study together provide a
        principled methodology for simulation-based astronomical machine learning under distribution
        shift.
      </p>

      <div className="mb-6 rounded-xl border border-orange-500/30 bg-gray-900/80 p-6">
        <h4 className="text-lg font-semibold text-orange-400 mb-2">
          Interactive Dashboard
        </h4>
        <p className="text-gray-300 leading-relaxed mb-4">
          The dissertation demo now has a dedicated page inside the portfolio site itself, rebuilt
          in React so it opens like the rest of the website while preserving the exploratory
          catalogue, threshold, and cluster-inspection workflow.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-500"
          >
            Open Dissertation Dashboard
          </button>
        </div>
      </div>

      {/* Resources */}
      <h4 className="text-lg font-semibold text-gray-300 mb-2">
        Resources & Outputs
      </h4>
      <ul className="list-disc list-inside text-gray-400 space-y-1">
        <li>Simulation frameworks: MOCCA (Monte Carlo), RAPSTER (semi-analytic), with DRAGON direct N-body used for cross-code validation</li>
        <li>Machine learning methods: CatBoost, XGBoost, Residual MLP, Stacking Ensemble (logistic regression meta-learner)</li>
        <li>Feature engineering: 8-feature observable contract including two novel structural ratios, determined via leave-one-feature-out ablation</li>
        <li>Catalogues: Harris (111 GCs), Baumgardt-Hilker (84 GCs), Holger Baumgardt (167 GCs)</li>
        <li>Code and analysis scripts to be released via GitHub</li>
      </ul>

      {/* Context */}
      <br></br>
      <p className="text-gray-500 leading-relaxed mt-6">
        This work builds on Askar et al. (2019)'s foundational single-code approach, extending it
        through mixed-code ensemble training, explicit domain shift analysis, and deployment to
        three independent observational catalogues, providing prioritised candidate lists for future
        spectroscopic follow-up.
      </p>
    </div>
  </section>
);

export default DissertationSection;
