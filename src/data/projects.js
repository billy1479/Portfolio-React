const publicUrl = process.env.PUBLIC_URL || '';

const projects = [
  // Arden
  {
    title: "Jobsheet system - Power App",
    languages: "Power Apps, Power Automate",
    backend: "SharePoint, Dataverse",
    description: "Power Platform solution for ArdenIT where staff can enter in required fields for jobsheets that are sent to the accounts team via a printed out invoice. Data modelled using SharePoint lists and Dataverse tables. Connects with Freshdesk.",
    links: [],
    images: [require('../assets/Projects/jobsheet-system-power-app/powerapps.png')]
  },
  {
    title: "Calendar",
    languages: "Power Apps, Power Automate",
    backend: "SharePoint",
    description: "Business calendar for event planning and scheduling. Connects with Power Platform ecosystem for scheduling engineers out on site, timetabling meetings, and booking time off. Data modelled using SharePoint lists. Connects with Freshdesk.",
    links: [],
    images: [require('../assets/Projects/calendar/powerapps.png')]
  },
  {
    title: "Purchase Ledger",
    languages: "Power Apps, Power Automate",
    backend: "SharePoint",
    description: "Inventory system which is modelled using SharePoint lists for asset management. Connects with Power Platform ecosystem.",
    links: [],
    images: [require('../assets/Projects/purchase-ledger/powerapps.png')]
  },
  {
    title: "Jobsheet system - PHP and Node.JS Web app",
    languages: "Node.JS, PHP, MySQL",
    backend: "MySQL",
    description: "Web app (initially in PHP, then in Node.JS) for jobsheet completion and submission. Data compiled into PDFs and emailed to accounts team. Stored data in MySQL backend.",
    links: [
      { url: "https://github.com/billy1479/JobSheets_NodeJS", label: "NodeJS GitHub Repo" },
      { url: "https://github.com/billy1479/JobSheets_PHP", label: "PHP GitHub Repo" }
    ],
    images: [require('../assets/Projects/jobsheet-system-php-and-node-js-web-app/nodejs.png')]
  },
  {
    title: "Inventory system",
    languages: "Node.JS, MySQL",
    backend: "MySQL",
    description: "Inventory system for tracking asset location based off shelf barcodes. Items were scanned and assigned to shelves and logged in MySQL database",
    links: [{ url: "https://github.com/billy1479/Inventory", label: "GitHub Repo" },],
    images: [require('../assets/Projects/inventory-system/nodejs.png')]
  },

  // University
  {
    title: "Machine Learning Coursework",
    module: "Machine Learning",
    languages: "Python, Pandas, Sklearn",
    backend: "None",
    courseworkPercentage: 70,
    description: "Coursework for using KNN and Random Forest for the UCI Adult dataset for binary classification of income based off socio-economic factors.",
    links: [
      { url: "https://github.com/billy1479/AICoursework", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/machine-learning-coursework/python.png')]
  },
  {
    title: "Networking Coursework",
    module: "Networking",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Python-based client-server application that enables multiple users to send messages and transfer files over a network using sockets and threading. Users can authenticate, chat (direct or broadcast), and download files from a shared server folder, with all operations handled concurrently by a multi-threaded server.",
    links: [
      { url: "https://github.com/billy1479/NetworkingCoursework", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/networking-coursework/python.png')]
  },
  {
    title: "Programming Paradigms Coursework",
    module: "Programming Paradigms",
    languages: "C++",
    backend: "None",
    courseworkPercentage: 70,
    description: "Implements lattice reduction using the LLL algorithm and searches for the shortest vector in a given lattice basis. Designed for educational and experimental exploration of lattice algorithms and outputs the shortest vector's norm to a file.",
    links: [
      { url: "https://github.com/billy1479/PPCoursework", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/programming-paradigms-coursework/cpp.png')]
  },
  {
    title: "Image Processing",
    module: "Image Processing",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Coursework project for Year 2 Data Science focused on enhancing and classifying X-ray images using OpenCV and neural networks. Provides automated pipelines for image correction and disease classification to support medical image analysis.",
    links: [
      { url: "https://github.com/billy1479/ImageProcessing", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/image-processing/python.png')]
  },
  {
    title: "Travelling Salesman Problem - AI Search",
    module: "AI Search",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Coursework for solving the Travelling Salesman Problem (TSP) using various AI search algorithms. Includes both basic and enhanced implementations of Greedy Search and Ant Colony Optimization, along with scripts for running experiments and validating results.",
    links: [
      { url: "https://github.com/billy1479/AISearch", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/travelling-salesman-problem-ai-search/python.png')]
  },
  {
    title: "Reinforcement Learning",
    module: "Reinforcement Learning",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Implements a TD3 (Twin Delayed Deep Deterministic Policy Gradient) agent for the Bipedal Walker environment using the rldurham gym. Extends the original work by Jinghao and adapts it for both the standard ('softcore') and 'hardcore' versions of the environment.",
    links: [
      { url: `${publicUrl}/RL/nkfn77-agent-video,episode=2390,score=328.3514828829743.mp4`, label: "Softcore Video" },
      { url: `${publicUrl}/RL/nkfn77-agent-hardcore-video,episode=6860,score=325.290321232454.mp4`, label: "Hardcore Video" },
      { url: "https://github.com/billy1479/ReinforcementLearning", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/reinforcement-learning/python.png')]
  },
  {
    title: "Virtual Reality Coursework",
    module: "Virtual Reality",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Simulates a VR headset and multiple headsets interacting on a virtual floor, using real IMU (Inertial Measurement Unit) data for realistic orientation and sensor fusion. The simulation is rendered in Python and produces video outputs demonstrating both pure gyroscope and sensor fusion tracking.",
    links: [
      { url: "https://github.com/billy1479/VRCoursework", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/virtual-reality-coursework/python.png')]
  },
  {
    title: "Advanced Computer Graphics I",
    module: "Advanced Computer Graphics",
    languages: "Three.js, Real-Time Graphics",
    backend: "None",
    courseworkPercentage: 70,
    description: "Advanced Computer Graphics coursework project simulating a stylised Durham Lumiere light festival. The scene combines procedural cathedral architecture, terrain, foliage, water, animated crowds and drones into a large interactive environment. It implements core engine-style systems including parametric geometry generation, spatial partitioning, LOD, hardware instancing, steering behaviours, raycast-based avoidance, animation, anti-aliasing and post-processing to maintain real-time performance with 1,000+ active entities.",
    links: [
      { url: `${publicUrl}/ACGI/nkfn77.html`, label: "Live Demo" },
      { url: "https://github.com/billy1479/AdvancedComputerGraphics/tree/main/Coursework_PartA", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/william-stapleton/nodejs.png')]
  },
  {
    title: "Advanced Computer Graphics Scientific Visualisation",
    module: "Advanced Computer Graphics and Visualisation",
    languages: "Python, React",
    backend: "None",
    courseworkPercentage: 70,
    description: "Advanced Computer Graphics and Visualisation coursework project creating two interactive lunar south pole visualisations for NASA’s Artemis III mission. The first app is an exploratory mission-planning tool that visualises real LROC/LOLA lunar elevation, illumination and permanently shadowed-region data to help assess safe and scientifically valuable landing sites. It supports multi-scale map exploration, click-based data sampling, suitability scoring, 3D displacement rendering, contour overlays, PSR overlays, illumination analysis and interactive parameter control. The second app is a public-facing communication visualisation designed to explain why Artemis III targets the lunar south pole. It combines scientific visualisation, infographics and narrative UI design to show how terrain, sunlight, shadow and possible water-ice regions affect mission planning. Together, the apps demonstrate a full visualisation pipeline: data loading, filtering, spatial mapping, colour design, terrain rendering, interaction, accessibility-focused presentation and performance-conscious map generation.",
    links: [
      { url: `${publicUrl}/ACGII/problem2_story.html`, label: "Live Demo" },
      { url: "https://github.com/billy1479/AdvancedComputerGraphicsPart2", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/william-stapleton/nodejs.png')]
  },
  {
    title: "Multimedia Game Development",
    module: "Multimedia Game Development",
    languages: "C#, Unity",
    backend: "Unity",
    courseworkPercentage: 70,
    description: "Unity game built to model the MCS building at Durham University. Consists of FPS elements, and a story where a player must traverse the levels to escape the building.",
    links: [
      { url: "https://1drv.ms/u/c/1ca77314ea9d2133/ETMhneoUc6cggBwFpwMAAAABRQicj7ormQdsOUaL-4GZag?e=iVKXFM", label: "Download/Play" }
    ],
    images: [require('../assets/Projects/multimedia-game-development/csharp.png')]
  },
  {
    title: "Recommender Systems",
    module: "Recommender Systems",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Builds two different game recommendation engines using Steam gaming data - a basic system (RS1) and an advanced system (RS2) that uses NLP techniques like sentiment analysis and Transformer models to enhance recommendations. Includes evaluation tools to compare the performance of both recommendation approaches.",
    links: [
      { url: "https://github.com/billy1479/RecommenderSystems", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/recommender-systems/python.png')]
  },
  {
    title: "Cryptography",
    module: "Cryptography",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Implements fundamental cryptographic algorithms based on the discrete logarithm problem, including Diffie-Hellman key exchange, ElGamal encryption/decryption, and various discrete logarithm solvers. Provides both secure cryptographic operations and cryptanalysis tools.",
    links: [
      { url: "https://github.com/billy1479/CryptographyCoursework", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/cryptography/python.png')]
  },
  {
    title: "Deep-Learning",
    module: "Deep Learning",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Implements both generative and discriminative models using PyTorch, featuring a Conditional GAN for generating CIFAR-100 images and a CNN-based classifier for multi-class image classification on a 20-class dataset.",
    links: [
      { url: "https://github.com/billy1479/Deep-Learning", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/deep-learning/python.png')]
  },
  {
    title: "Natural Language Processing",
    module: "Natural Language Processing",
    languages: "Python",
    backend: "None",
    courseworkPercentage: 70,
    description: "Natural Language Processing coursework project for rumour stance detection on social media discussion threads. The system classifies reply tweets relative to a source rumour into Support, Deny, Query or Comment categories, using both source and reply text as model input. It combines dataset analytics, unigram/bigram analysis, LDA topic modelling, transformer-based tweet classification, LLM prompting, class-imbalance handling, confusion-matrix evaluation and a two-stage Comment-vs-Non-Comment pipeline to improve minority-class stance detection.",
    links: [
      { url: "https://github.com/billy1479/NaturalLanguageProcessing", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/machine-learning-coursework/python.png')]
  },
  {
    title: "Blockchain and Cryptocurrencies",
    module: "Blockchain and Cryptocurrencies",
    languages: "Python, Solidity, Bitcoin Script",
    backend: "Python",
    courseworkPercentage: 70,
    description: "COMP4137 Blockchain and Cryptocurrencies coursework implementing a four-part blockchain system centred on agro-supply chain management. Q1 builds a full supply chain blockchain in Python featuring ECDSA-based stakeholder identity generation with QR code registration, SHA-256 proof-of-work mining with configurable difficulty, end-to-end transaction traceability across stakeholders, and a comparative energy analysis between PoW and PoS consensus mechanisms aligned with UN SDG 2030 targets. Q2 implements a bidirectional-linked blockchain with chameleon hash functions and a Preference-Based Committee Member Auction (CMA) consensus algorithm based on Mathur et al. (2025), using VRF-based committee election and the Balanced Preference Model to achieve sub-millisecond block times and 100% stakeholder participation versus Bitcoin's energy-intensive mining. Q3 delivers a Solidity smart contract for circular supply chain inventory management on Ethereum, covering product lifecycle tracking, inter-store transfers, shelf-life monitoring and automated recycling workflows, tested on both Ganache and Sepolia testnet. Q4 implements Bitcoin scripting solutions including hash puzzle redemption scripts and a 2-of-3 MultiSig P2SH transaction with security analysis, validated using a Bitcoin script debugger.",
    links: [
      { url: "https://github.com/billy1479/BlockchainAndCryptocurrencies", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/machine-learning-coursework/python.png')]
  },
  {
    title: "Interconnection Networks for Parallel Computing",
    module: "Interconnection Networks for Parallel Computing",
    languages: "Python, Graph Theory, Algorithms",
    backend: "None",
    courseworkPercentage: 70,
    description: "Interconnection Networks for Parallel Computing coursework project covering rigorous mathematical analysis and algorithmic implementation across a range of network topologies. The written component derives graph-theoretic properties - node counts, degree, diameter, bisection width, and throughput bounds - for k-ary n-cubes, hypercubes, cube-connected cycles, Petersen graphs, circulant graphs, bubble-sort networks, and augmented cubes, grounding every result in formal proofs tied to Moore bounds, spanning-tree arguments, and channel-load analysis. The implementation delivers a fault-tolerant routing algorithm for the k-ary n-cube Q^n_k using incremental dimension-order routing with strictly local fault knowledge: at each hop the agent inspects only channels incident to the current node, applies perimeter-routing detours when the preferred dimension is faulty, falls back to reverse-direction traversal, and terminates gracefully under disconnection. Supporting functions provide all-to-all and randomised traffic pattern generators alongside a fault generator parameterised by count or percentage. The algorithm sustains over 22,000 routes per second on all-to-all traffic for n=5, k=5, satisfying the performance benchmarks set by the assignment.",
    links: [
      { url: "https://github.com/billy1479/NetworksAndTheirStructure", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/machine-learning-coursework/python.png')]
  },
  {
    title: "Network Science",
    module: "Network Science",
    languages: "Python, Network Science, Graph Theory, Epidemic Modelling",
    backend: "None",
    courseworkPercentage: 70,
    description: "Network Science coursework project spanning three interconnected investigations into real-world network structure, searchability, and epidemic dynamics. The first question analyses a real citation network against a Preferential Attachment (PA) model, comparing normalised closeness centrality distributions and tracking how individual node centralities evolve as the graph grows - revealing the compounding advantage of early-arriving nodes in networks governed by \"rich get richer\" attachment. It then extends this to a hybrid P-network model parameterised by n, m and p, blending preferential attachment with random neighbour selection to explore how varying p shifts the resulting degree distribution between scale-free and random regimes. The second question implements the Kleinberg small-world model on a circular lattice with rewiring probability p and distance-biased long-range links, and measures greedy search time across varying alpha and network sizes up to n = 4000 - empirically confirming the theoretically optimal alpha and characterising the logarithmic growth of search time with node count. The third question simulates epidemic spread on Variable Degree Watts-Strogatz (VDWS) networks of 200,000 nodes using a five-state model (S, I, V, VI, R), first with random vaccination from t = 50 onward to establish baseline dynamics under varying transmission and vaccine-efficacy parameters, then with three strategic vaccination schemes - high-degree targeting, ring vaccination, and PageRank-based selection - evaluated for their ability to suppress peak infection and accelerate epidemic termination relative to random rollout.",
    links: [
      { url: "https://github.com/billy1479/NetworksAndTheirStructure", label: "GitHub Repo" }
    ],
    images: [require('../assets/Projects/machine-learning-coursework/python.png')]
  },

  // IBM
  {
    title: "IBM Skills Build AR Application",
    languages: "C#, Unity, Google Firebase",
    backend: "Google Firebase",
    description: "Developed a VR application for the IBM Skills Build with a small team of developers. App was designed for mobile devices, where users would scan an AR icon and would then be redirected to the IBM Skills Build website. Users could sign-up, favourite courses and rate other users recommended courses. Data was modelled using Google Firebase.",
    links: [],
    images: [require('../assets/Projects/ibm-skills-build-ar-application/csharp.png')]
  },

  // MoveIn
  {
    title: "MoveIn - Student House-finding App",
    languages: "Flutter",
    backend: "Google Firebase, Azure",
    description: "Developed a flutter mobile application to help students find housemates. Worked on a small developer team at University with the hope of launching the app on the app store. Users could create accounts, stored in Firebase, and create virtual houses where other users could join in the hope of finding housemates. App has chat functionality and allowed for upload of images which were stored on Azure.",
    links: [],
    images: [require('../assets/Projects/movein-student-house-finding-app/flutter.png')]
  },

  // Websites
  {
    title: "William Stapleton",
    languages: "Node.JS, React",
    backend: "",
    description: "React Web App for my own portfolio (this website).",
    links: [
      { url: "https://www.williamstapleton.co.uk", label: "Portfolio Website" }
    ],
    images: [require('../assets/Projects/william-stapleton/nodejs.png')]
  }
];

export default projects;
