import React from 'react';

const AboutSection = () => {
  return (
    <section id="about" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">About Me</h2>
        <div className="space-y-4">
          <p className="text-lg text-gray-300">
            I'm a final-year Computer Science student at Durham University with a passion for cybersecurity and software development. Currently working as a Software Engineer at TEKGEM, I specialize in building secure applications using C# and React.js for critical infrastructure protection. Beyond my formal studies, I've pursued extensive Microsoft certifications including Power Platform Developer Associate, Azure Fundamentals, Security Compliance and Identity Fundamentals, Azure Data Fundamentals, and Microsoft 365 Fundamentals—demonstrating my commitment to staying current with industry-leading cloud technologies and security practices.

          </p>
          <p className="text-lg text-gray-300">
            My experience spans the Microsoft Power Platform, where I've developed custom solutions for universities and businesses, earning recognition including Durham University's 'Above and Beyond' award. I thrive in challenging environments and enjoy combining technical expertise with practical problem-solving to create applications that make a real difference. When I'm not coding, I'm exploring new technologies and continuously expanding my skill set through professional certifications and hands-on projects in AI, cybersecurity, and modern development frameworks.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;