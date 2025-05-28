// NOTE: This file must not use 'fs', 'path', or 'gray-matter' in the browser.
// Instead, manually maintain the array or generate it at build time.

const projects = [
  // Arden
  {
    title: "Jobsheet system - Power App",
    languages: "Power Apps, Power Automate",
    backend: "Power Platform, SharePoint, Dataverse",
    description: "Powr Platform solution for ArdenIT where staff can enter in required fields for jobsheets that are sent to the accounts team via a printed out invoice. Data modelled using SharePoint lists and Dataverse tables. Connects with Freshdesk.",
    links: [],
    images: []
  },
  {
    title: "Calendar",
    languages: "Power Apps, Power Automate",
    backend: "Power Platform, SharePoint",
    description: "Business calendar for event planning and scheduling. Connects with Power Platform ecosystem for scheduling engineers out on site, timetabling meetings, and booking time off. Data modelled using Sharepoint lists. Connects with Freshdesk.",
    links: [],
    images: []
  },
  {
    title: "Purchase Ledger",
    languages: "Power Apps, Power Automate",
    backend: "Power Platform, SharePoint",
    description: "Inventory system which is modelled using SharePoint lists for asset management. Connects with Power Platform ecosystem.",
    links: [],
    images: []
  },
  {
    title: "Jobsheet system - PHP and Node.JS Web app",
    languages: "Node.JS, PHP, MySQL",
    backend: "Node.JS, PHP, MySQL",
    description: "Web app (initially in PHP, then in Node.JS) for jobsheet completion and submission. Data compiled into PDFs and emailed to accounts team. Stored data in MySQL backend.",
    links: [
      "https://github.com/billy1479/JobSheets_NodeJS",
      "https://github.com/billy1479/JobSheets_PHP"
    ],
    images: []
  },
  {
    title: "Inventory system",
    languages: "Node.JS, MySQL",
    backend: "Node.JS, MySQL",
    description: "Inventory system for tracking asset location based off shelf barcodes. Items were scanned and assigned to shelves and logged in MySQL database",
    links: [],
    images: []
  },

  // University
  {
    title: "Machine Learning Coursework",
    languages: "Python, Pandas, Sklearn",
    backend: "None",
    description: "Coursework for using KNN and Random Forest for the UCI Adult dataset for binary classification of income based off socio-economic factors.",
    links: [
      "https://github.com/billy1479/AICoursework"
    ],
    images: []
  },
  {
    title: "Networking Coursework",
    languages: "Python",
    backend: "None",
    description: "Python-based client-server application that enables multiple users to send messages and transfer files over a network using sockets and threading. Users can authenticate, chat (direct or broadcast), and download files from a shared server folder, with all operations handled concurrently by a multi-threaded server.",
    links: [
      "https://github.com/billy1479/NetworkingCoursework"
    ],
    images: []
  },
  {
    title: "Programming Paradigms Coursework",
    languages: "C++",
    backend: "None",
    description: "Implements lattice reduction using the LLL algorithm and searches for the shortest vector in a given lattice basis. Designed for educational and experimental exploration of lattice algorithms and outputs the shortest vector's norm to a file.",
    links: [
      "https://github.com/billy1479/PPCoursework"
    ],
    images: []
  },
  {
    title: "Image Processing",
    languages: "Python",
    backend: "None",
    description: "Coursework project for Year 2 Data Science focused on enhancing and classifying X-ray images using OpenCV and neural networks. Provides automated pipelines for image correction and disease classification to support medical image analysis.",
    links: [
      "https://github.com/billy1479/ImageProcessing"
    ],
    images: []
  },
  {
    title: "Travelling Salesman Problem - AI Search",
    languages: "Python",
    backend: "None",
    description: "Coursework for solving the Travelling Salesman Problem (TSP) using various AI search algorithms. Includes both basic and enhanced implementations of Greedy Search and Ant Colony Optimization, along with scripts for running experiments and validating results.",
    links: [
      "https://github.com/billy1479/AISearch"
    ],
    images: []
  },
  {
    title: "Reinforcement Learning",
    languages: "Python",
    backend: "None",
    description: "Implements a TD3 (Twin Delayed Deep Deterministic Policy Gradient) agent for the Bipedal Walker environment using the rldurham gym. Extends the original work by Jinghao and adapts it for both the standard ('softcore') and 'hardcore' versions of the environment.",
    links: [
      "https://github.com/billy1479/ReinforcementLearning"
    ],
    images: []
  },
  {
    title: "Virtual Reality Coursework",
    languages: "Python",
    backend: "None",
    description: "Simulates a VR headset and multiple headsets interacting on a virtual floor, using real IMU (Inertial Measurement Unit) data for realistic orientation and sensor fusion. The simulation is rendered in Python and produces video outputs demonstrating both pure gyroscope and sensor fusion tracking.",
    links: [
      "https://github.com/billy1479/VRCoursework"
    ],
    images: []
  },
  {
    title: "Multimedia Game Development",
    languages: "C#, Unity",
    backend: "Unity",
    description: "Unity game built to model the MCS building at Durham University. Consists of FPS elements, and a story where a player must traverse the levels to escape the building.",
    links: [
      "https://1drv.ms/u/c/1ca77314ea9d2133/ETMhneoUc6cggBwFpwMAAAABRQicj7ormQdsOUaL-4GZag?e=iVKXFM"
    ],
    images: []
  },
  {
    title: "Recommender Systems",
    languages: "Python",
    backend: "None",
    description: "Builds two different game recommendation engines using Steam gaming data - a basic system (RS1) and an advanced system (RS2) that uses NLP techniques like sentiment analysis and Transformer models to enhance recommendations. Includes evaluation tools to compare the performance of both recommendation approaches.",
    links: [
      "https://github.com/billy1479/RecommenderSystems"
    ],
    images: []
  },
  {
    title: "Cryptography",
    languages: "Python",
    backend: "None",
    description: "Implements fundamental cryptographic algorithms based on the discrete logarithm problem, including Diffie-Hellman key exchange, ElGamal encryption/decryption, and various discrete logarithm solvers. Provides both secure cryptographic operations and cryptanalysis tools.",
    links: [
      "https://github.com/billy1479/CryptographyCoursework"
    ],
    images: []
  },
  {
    title: "Deep-Learning",
    languages: "Python",
    backend: "PyTorch",
    description: "Implements both generative and discriminative models using PyTorch, featuring a Conditional GAN for generating CIFAR-100 images and a CNN-based classifier for multi-class image classification on a 20-class dataset.",
    links: [
      "https://github.com/billy1479/Deep-Learning"
    ],
    images: []
  },

  // IBM
  {
    title: "IBM Skills Build AR Application",
    languages: "C#, Unity, Google Firebase",
    backend: "Google Firebase",
    description: "Developed a VR application for the IBM Skills Build with a small team of developers. App was designed for mobile devices, where users would scan an AR icon and would then be redirected to the IBM Skills Build website. Users could sign-up, favourite courses and rate other users recommended courses. Data was modelled using Google Firebase.",
    links: [],
    images: []
  },

  // MoveIn
  {
    title: "MoveIn - Student House-finding App",
    languages: "Flutter",
    backend: "Google Firebase, Azure",
    description: "Developed a flutter mobile application to help students find housemates. Worked on a small developer team at University with the hope of launching the app on the app store. Users could create accounts, stored in Firebase, and create virtual houses where other users could join in the hope of finding housemates. App has chat functionality and allowed for upload of images which were stored on Azure.",
    links: [],
    images: []
  },

  // Websites
  {
    title: "William Stapleton",
    languages: "Node.JS, React",
    backend: "Node.JS",
    description: "React Web App for my own portfolio (this website).",
    links: [
      "https://www.williamstapleton.co.uk"
    ],
    images: []
  },
  {
    title: "LBL Digital",
    languages: "Node.JS",
    backend: "Node.JS",
    description: "Node.JS web app for LBL Digital, a M365 solution provider.",
    links: [
      "https://www.lbldigital.com"
    ],
    images: []
  },
  {
    title: "Toot Hill School Student Union Website",
    languages: "PHP",
    backend: "PHP",
    description: "PHP web app for Toot Hill Student Union for guiding students through SU resources and activities.",
    links: [],
    images: []
  }
];

export default projects;