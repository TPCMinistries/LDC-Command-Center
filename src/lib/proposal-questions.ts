// Question sets for guided proposal writing
// Each section type has a series of questions to help users write content

export interface ProposalQuestion {
  id: string
  question: string
  placeholder?: string
  helpText?: string
  inputType: 'text' | 'textarea' | 'number' | 'date' | 'select'
  options?: { value: string; label: string }[]
  required?: boolean
}

export interface SectionQuestions {
  sectionType: string
  displayName: string
  description: string
  tips: string[]
  questions: ProposalQuestion[]
}

export const SECTION_QUESTIONS: Record<string, SectionQuestions> = {
  executive_summary: {
    sectionType: 'executive_summary',
    displayName: 'Executive Summary',
    description: 'A compelling overview of your entire proposal in 1-2 pages.',
    tips: [
      'Write this section last, after completing all other sections',
      'Include your ask amount and key outcomes prominently',
      'Make it compelling - this may be the only section some reviewers read closely',
      'Keep it concise but comprehensive',
    ],
    questions: [
      {
        id: 'one_sentence_summary',
        question: 'In one sentence, what is your program and what will it achieve?',
        placeholder: 'Our [program name] will [primary outcome] for [target population] by [key activities].',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'total_ask',
        question: 'What is your total funding request?',
        placeholder: '$250,000',
        inputType: 'text',
        required: true,
      },
      {
        id: 'program_duration',
        question: 'What is the proposed program period?',
        placeholder: 'e.g., 12 months, July 2024 - June 2025',
        inputType: 'text',
      },
      {
        id: 'key_outcomes',
        question: 'What are the 2-3 most important outcomes you will achieve?',
        placeholder: '1. Serve 500 youth with job readiness training\n2. Place 300 youth in employment or internships\n3. Achieve 85% program completion rate',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'why_your_org',
        question: 'Why is your organization uniquely positioned to deliver this program?',
        placeholder: 'Highlight your track record, expertise, partnerships, and unique advantages.',
        inputType: 'textarea',
        required: true,
      },
    ],
  },

  organizational_background: {
    sectionType: 'organizational_background',
    displayName: 'Organizational Background',
    description: "Demonstrate your organization's capability and track record.",
    tips: [
      'Focus on relevant experience for this specific program',
      'Include concrete numbers and success metrics',
      'Mention key partnerships and collaborations',
      'Keep it relevant - not a complete org history',
    ],
    questions: [
      {
        id: 'mission',
        question: "What is your organization's mission?",
        placeholder: 'Our mission is to...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'founding_year',
        question: 'When was your organization founded?',
        placeholder: '2010',
        inputType: 'text',
      },
      {
        id: 'annual_budget',
        question: "What is your organization's annual operating budget?",
        placeholder: '$2.5 million',
        inputType: 'text',
      },
      {
        id: 'staff_size',
        question: 'How many staff members does your organization have?',
        placeholder: '25 full-time, 10 part-time',
        inputType: 'text',
      },
      {
        id: 'relevant_experience',
        question: 'Describe your experience delivering similar programs.',
        placeholder: 'We have operated workforce development programs since 2015, serving over 5,000 participants...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'past_success',
        question: 'What specific outcomes have you achieved in similar programs?',
        placeholder: 'In our last workforce program, we achieved 78% job placement rate, with participants earning an average of $18/hour...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'key_partners',
        question: 'Who are your key partners for this work?',
        placeholder: 'We partner with NYC DOE for participant referrals, local employers for job placements...',
        inputType: 'textarea',
      },
    ],
  },

  statement_of_need: {
    sectionType: 'statement_of_need',
    displayName: 'Statement of Need',
    description: 'Make the case for why this program is necessary now.',
    tips: [
      'Use recent, credible data and citations',
      'Connect the need to your specific community/population',
      'Show why existing services are insufficient',
      'Make it compelling but not hopeless - show the opportunity',
    ],
    questions: [
      {
        id: 'problem_statement',
        question: 'What specific problem or need are you addressing?',
        placeholder: 'Young adults ages 18-24 in our community face significant barriers to employment...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'data_evidence',
        question: 'What data supports this need? (Include sources)',
        placeholder: 'According to NYC DOL (2023), youth unemployment in our target zip codes is 28%, compared to 12% citywide...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'target_population',
        question: 'Who specifically will you serve? (demographics, geography, characteristics)',
        placeholder: 'Out-of-school, out-of-work young adults ages 18-24 residing in South Bronx neighborhoods...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'why_now',
        question: 'Why is addressing this need urgent now?',
        placeholder: 'Post-pandemic recovery has created new employment opportunities, but youth need skills and support to access them...',
        inputType: 'textarea',
      },
      {
        id: 'service_gap',
        question: "What gap in existing services will your program fill?",
        placeholder: 'While job training programs exist, few offer the wraparound supports (childcare, transportation) that our population needs...',
        inputType: 'textarea',
      },
    ],
  },

  program_design: {
    sectionType: 'program_design',
    displayName: 'Program Design',
    description: 'Detail how your program will work and achieve outcomes.',
    tips: [
      'Be specific about activities, dosage, and duration',
      'Show how activities connect to outcomes',
      'Address potential barriers and how you will overcome them',
      'Include innovative or evidence-based approaches',
    ],
    questions: [
      {
        id: 'program_model',
        question: 'Describe your overall program model.',
        placeholder: 'Our program uses a phased approach: 1) Recruitment & intake, 2) Skills training, 3) Work experience, 4) Job placement & retention support...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'key_activities',
        question: 'What are the core activities participants will engage in?',
        placeholder: '- Weekly job readiness workshops (2 hours)\n- Occupational skills training (40 hours)\n- Paid internship placement (160 hours)\n- Individual career coaching (bi-weekly)',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'participant_journey',
        question: 'Walk through a typical participant journey from enrollment to completion.',
        placeholder: 'Week 1-2: Orientation and assessment. Week 3-6: Core skills training. Week 7-12: Internship placement...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'evidence_base',
        question: 'What evidence or best practices inform your program design?',
        placeholder: 'Our model incorporates elements from the JTPA best practices guide and builds on our successful pilot program...',
        inputType: 'textarea',
      },
      {
        id: 'barriers_solutions',
        question: 'What barriers might participants face and how will you address them?',
        placeholder: 'Transportation: We provide MetroCards. Childcare: Partnerships with local providers. Food insecurity: Daily meals provided...',
        inputType: 'textarea',
      },
    ],
  },

  implementation_plan: {
    sectionType: 'implementation_plan',
    displayName: 'Implementation Plan',
    description: 'Show how you will execute the program.',
    tips: [
      'Include a realistic timeline with milestones',
      'Address staffing and capacity',
      'Show how you will recruit participants',
      'Demonstrate you have thought through logistics',
    ],
    questions: [
      {
        id: 'recruitment_strategy',
        question: 'How will you recruit and enroll participants?',
        placeholder: 'We will recruit through community partnerships, social media outreach, and referrals from our existing programs...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'enrollment_timeline',
        question: 'What is your enrollment timeline and target numbers?',
        placeholder: 'We will enroll 50 participants per cohort across 4 cohorts, with new cohorts starting quarterly...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'staffing_plan',
        question: 'Who will implement the program? (roles and qualifications)',
        placeholder: 'Program Director (full-time): Oversees all operations. 2 Career Coaches: Provide individual support. 1 Training Coordinator...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'program_location',
        question: 'Where will the program be delivered?',
        placeholder: 'Our main site at 123 Main Street, with satellite locations at partner organizations...',
        inputType: 'textarea',
      },
      {
        id: 'key_milestones',
        question: 'What are the key milestones and timeline?',
        placeholder: 'Month 1-2: Staff hiring, curriculum finalization. Month 3: First cohort enrollment. Month 4-6: First cohort training...',
        inputType: 'textarea',
        required: true,
      },
    ],
  },

  evaluation_plan: {
    sectionType: 'evaluation_plan',
    displayName: 'Evaluation Plan',
    description: 'Describe how you will measure success.',
    tips: [
      'Include both output and outcome measures',
      'Be specific about data collection methods',
      'Set realistic but ambitious targets',
      'Show how you will use data for improvement',
    ],
    questions: [
      {
        id: 'key_outcomes',
        question: 'What are your primary outcome measures?',
        placeholder: '1. Job placement rate (target: 70%)\n2. 90-day job retention (target: 80%)\n3. Average starting wage (target: $17/hour)',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'output_measures',
        question: 'What outputs will you track?',
        placeholder: 'Number enrolled, training completion rate, internship hours completed, credentials earned...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'data_collection',
        question: 'How will you collect and track data?',
        placeholder: 'We use Salesforce to track participant progress. Staff enter data weekly. Quarterly reports generated automatically...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'continuous_improvement',
        question: 'How will you use data for continuous improvement?',
        placeholder: 'Monthly staff meetings review data dashboards. Quarterly program adjustments based on outcomes. Annual external evaluation...',
        inputType: 'textarea',
      },
    ],
  },

  budget_narrative: {
    sectionType: 'budget_narrative',
    displayName: 'Budget Narrative',
    description: 'Justify your budget and explain how funds will be used.',
    tips: [
      'Connect every expense to program activities',
      'Show cost-effectiveness where possible',
      'Explain any large or unusual line items',
      'Include any matching or leveraged funds',
    ],
    questions: [
      {
        id: 'personnel_justification',
        question: 'Explain your personnel costs.',
        placeholder: 'Program Director (1 FTE @ $75,000): Provides overall leadership and quality assurance. Career Coaches (2 FTE @ $55,000 each)...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'program_costs',
        question: 'Explain key program costs (supplies, materials, participant support).',
        placeholder: 'Training materials ($5,000): Includes workbooks, supplies for each participant. Participant stipends ($30,000): $200/month for 150 participants...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'indirect_costs',
        question: 'Explain indirect/administrative costs.',
        placeholder: 'Indirect costs at 15% ($22,500) cover facilities, utilities, IT, and administrative support...',
        inputType: 'textarea',
      },
      {
        id: 'cost_per_participant',
        question: 'What is your cost per participant?',
        placeholder: 'Total cost of $250,000 / 200 participants = $1,250 per participant, which compares favorably to...',
        inputType: 'textarea',
      },
      {
        id: 'other_funding',
        question: 'What other funding sources support this program?',
        placeholder: 'We are leveraging $50,000 in existing foundation grants and $25,000 in corporate partnerships...',
        inputType: 'textarea',
      },
    ],
  },

  sustainability_plan: {
    sectionType: 'sustainability_plan',
    displayName: 'Sustainability Plan',
    description: 'Show how the program will continue beyond this funding.',
    tips: [
      'Be realistic about funding diversification',
      'Include specific plans, not just hopes',
      'Consider program sustainability vs. organizational sustainability',
      'Show a track record of sustaining programs',
    ],
    questions: [
      {
        id: 'diversification_strategy',
        question: 'How will you diversify funding for this program?',
        placeholder: 'We are pursuing additional government contracts, foundation grants, and developing earned revenue through employer partnerships...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'long_term_vision',
        question: "What is your long-term vision for this program's sustainability?",
        placeholder: 'Within 3 years, we aim to have 40% of program costs covered by employer partnerships and earned revenue...',
        inputType: 'textarea',
      },
      {
        id: 'track_record',
        question: 'What is your track record of sustaining programs?',
        placeholder: 'Our flagship program launched in 2018 with seed funding and has since diversified to 5 funding sources...',
        inputType: 'textarea',
      },
    ],
  },

  cover_letter: {
    sectionType: 'cover_letter',
    displayName: 'Cover Letter',
    description: 'A brief introduction to your proposal.',
    tips: [
      'Keep it to one page',
      'State your ask clearly',
      'Show alignment with funder priorities',
      'Express genuine connection to the work',
    ],
    questions: [
      {
        id: 'opening_hook',
        question: 'What is your compelling opening statement?',
        placeholder: 'Every day, 500 young people in our community wake up without a pathway to employment...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'request_statement',
        question: 'State your funding request.',
        placeholder: 'We are requesting $250,000 to expand our Youth Career Pathways program...',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'funder_alignment',
        question: "How does this align with the funder's priorities?",
        placeholder: "This proposal directly supports [Funder]'s commitment to workforce equity and economic mobility...",
        inputType: 'textarea',
      },
    ],
  },
}

// Get questions for a specific section type
export function getSectionQuestions(sectionType: string): SectionQuestions | undefined {
  return SECTION_QUESTIONS[sectionType]
}

// Get display name for a section type
export function getSectionDisplayName(sectionType: string): string {
  return SECTION_QUESTIONS[sectionType]?.displayName || sectionType.replace(/_/g, ' ')
}

// Get all available section types
export function getAllSectionTypes(): string[] {
  return Object.keys(SECTION_QUESTIONS)
}
