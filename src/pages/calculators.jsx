// src/pages/CalculatorsPage.jsx
import { Link } from 'react-router-dom';
import '../styles/CalculatorsPage.css';

const calculators = [
  {
    title: 'TDEE Calculator',
    image: '/images/TDEE.png',
    path: '/calculators/tdee',
    description:
      'Estimate daily calories needed based on activity level, weight, height, and age.',
    fullName: 'Total Daily Energy Expenditure',
  },
  {
    title: 'Protein Calculator',
    image: '/images/Protein.png',
    path: '/calculators/protein',
    description:
      'Find your optimal daily protein intake for muscle growth, fat loss, or maintenance.',
    fullName: null,
  },
  {
    title: '1RM Calculator',
    image: '/images/1RM.png',
    path: '/calculators/1rm',
    description:
      'Calculate your estimated one-rep max using popular strength formulas.',
    fullName: 'One-Rep Max',
  },
];

function CalculatorsPage() {
  return (
    <div className="calculators-container">
      <h1 className="calculators-title">Fitness Calculators</h1>

      <div className="calculator-grid">
        {calculators.map((calc, index) => (
          <Link to={calc.path} key={index} className="calculator-card">

            <div className="calculator-image-wrapper">
              <img
                src={calc.image}
                alt={calc.title}
                className="calculator-image"
              />
            </div>

            <h2 className="calculator-card-title">
              {calc.title}

              {/* Tooltip if fullName exists */}
              {calc.fullName && (
                <>
                  <span className="tooltip-icon">?</span>
                  <span className="tooltip-text">{calc.fullName}</span>
                </>
              )}
            </h2>

            <p className="calculator-description">{calc.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default CalculatorsPage;
