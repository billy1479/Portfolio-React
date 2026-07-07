import React from 'react';

const AboutSection = () => {
  return (
    <section id="about" className="w-full min-w-0 mb-16 bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-200 pb-2">About Me</h2>
        <div className="space-y-4">
          <p className="text-lg text-gray-700">
            I'm a First Class Honours Computer Science graduate from Durham University, now working as a Software Engineer on the Aero Performance team at Red Bull Racing. I specialise in building high-performance software systems, with experience spanning aerodynamic simulation pipelines, data analysis tools, and telemetry visualisation, alongside a strong foundation in C# and React from my time developing the UNITY cybersecurity platform at TEKGEM Ltd. Beyond my formal studies, I've pursued extensive Microsoft certifications including Power Platform Developer Associate, Azure Fundamentals, Security Compliance and Identity Fundamentals, Azure Data Fundamentals, and Microsoft 365 Fundamentals.
          </p>
          <p className="text-lg text-gray-700">
            My experience also spans the Microsoft Power Platform, where I developed custom solutions for Durham University and businesses through ArdenIT Ltd, earning recognition including Durham University's 'Above and Beyond' award and runner-up at the 2025 UK Universities HR Awards for Digital and Technological Innovation and Change. I thrive in challenging environments and enjoy combining technical expertise with practical problem-solving to create applications that make a real difference. When I'm not coding, I'm exploring new technologies and continuously expanding my skill set through professional certifications and hands-on projects in AI, cybersecurity, and modern development frameworks.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;