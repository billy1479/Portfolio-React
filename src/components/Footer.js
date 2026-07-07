import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full min-w-0 mx-auto text-center py-6 text-gray-500 border-t border-gray-200">
      <p>© {new Date().getFullYear()} William Stapleton. All rights reserved.</p>
      <p className="mt-1 text-sm">Made with React & Tailwind CSS</p>
    </footer>
  );
};

export default Footer;