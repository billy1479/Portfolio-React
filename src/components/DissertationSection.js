import React from 'react';

const DissertationSection = () => (
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
        structural indicators derived from realistic star cluster simulations.
      </p>

      {/* Methodology */}
      <h4 className="text-lg font-semibold text-gray-300 mb-2">
        Methodology & Technical Approach
      </h4>
      <p className="text-gray-400 leading-relaxed mb-4">
        The project combines large-scale astrophysical simulations with supervised machine learning.
        Custom direct N-body simulations are generated using the PETAR framework, modelling long-term
        star cluster evolution with stellar evolution and black hole dynamics included. Particle-level
        simulation outputs are transformed into observationally motivated, cluster-scale features
        such as surface brightness, velocity dispersion, relaxation time, and core and half-light
        radii, mirroring quantities accessible in real astronomical surveys.
      </p>
      <p className="text-gray-400 leading-relaxed mb-6">
        These features are used to train ensemble machine learning models, including Convolutional
        Neural Networks, Support Vector Machines, and Random Forests, designed to predict the presence
        of black hole subsystems while accounting for class imbalance. Model generalisation is tested
        using independent simulation suites from the DRAGON dataset and the MOCCA survey.
      </p>

      {/* Motivation & Novelty */}
      <h4 className="text-lg font-semibold text-gray-300 mb-2">
        Research Motivation & Novelty
      </h4>
      <p className="text-gray-400 leading-relaxed mb-6">
        Black holes in globular clusters are difficult to detect because most are non-accreting and
        electromagnetically quiet, and clusters with similar observable properties can evolve through
        very different dynamical pathways. This project explores whether machine learning can break
        these degeneracies by learning subtle, non-linear relationships between global cluster
        properties and hidden black hole populations that are challenging to capture using traditional
        analytical approaches.
      </p>

      {/* Resources */}
      <h4 className="text-lg font-semibold text-gray-300 mb-2">
        Resources & Outputs
      </h4>
      <ul className="list-disc list-inside text-gray-400 space-y-1">
        <li>Simulation framework: PETAR (direct N-body simulations)</li>
        <li>Validation datasets: DRAGON and MOCCA survey simulations</li>
        <li>Machine learning methods: CNNs, SVMs, Random Forests</li>
        <li>Code and analysis scripts to be released via GitHub</li>
      </ul>

      {/* Context */}
      <br></br>
      <p className="text-gray-500 leading-relaxed mt-6">
        This work builds on previous studies of black hole subsystem detection in globular clusters,
        extending earlier approaches through custom simulations, cross-dataset validation, and a
        stronger emphasis on generalisable, observation-driven machine learning models.
      </p>
    </div>
  </section>
);

export default DissertationSection;
