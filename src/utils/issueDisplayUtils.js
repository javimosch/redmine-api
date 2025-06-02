import { formatWithEmoji } from './emoji.js';

/**
 * Get emoji for priority level
 * @param {string} priorityName - Name of the priority
 * @returns {string} Emoji representing the priority
 */
export const getPriorityEmoji = (priorityName) => {
  if (!priorityName) return formatWithEmoji('', 'priority.normal');
  
  const lowerPriority = priorityName.toLowerCase();
  
  if (lowerPriority.includes('low') || lowerPriority.includes('basse')) {
    return formatWithEmoji('', 'priority.low');
  } else if (lowerPriority.includes('normal') || lowerPriority.includes('normale')) {
    return formatWithEmoji('', 'priority.normal');
  } else if (lowerPriority.includes('high') || lowerPriority.includes('haute')) {
    return formatWithEmoji('', 'priority.high');
  } else if (lowerPriority.includes('urgent')) {
    return formatWithEmoji('', 'priority.urgent');
  } else if (lowerPriority.includes('immediate')) {
    return formatWithEmoji('', 'priority.immediate');
  }
  
  return formatWithEmoji('', 'priority.normal');
};

/**
 * Get emoji for issue status
 * @param {string} statusName - Name of the status
 * @returns {string} Emoji representing the status
 */
export const getStatusEmoji = (statusName) => {
  if (!statusName) return formatWithEmoji('', 'status.new');
  
  const lowerStatus = statusName.toLowerCase();
  
  if (lowerStatus.includes('new') || lowerStatus.includes('déclaré')) {
    return formatWithEmoji('', 'status.new');
  } else if (lowerStatus.includes('progress') || lowerStatus.includes('cours')) {
    return formatWithEmoji('', 'status.inProgress');
  } else if (lowerStatus.includes('resolved') || lowerStatus.includes('résolu')) {
    return formatWithEmoji('', 'status.resolved');
  } else if (lowerStatus.includes('closed') || lowerStatus.includes('fermé')) {
    return formatWithEmoji('', 'status.closed');
  } else if (lowerStatus.includes('feedback') || lowerStatus.includes('retour')) {
    return formatWithEmoji('', 'status.feedback');
  } else if (lowerStatus.includes('reject') || lowerStatus.includes('rejeté')) {
    return formatWithEmoji('', 'status.rejected');
  }
  
  return formatWithEmoji('', 'status.new');
};

/**
 * Displays the formatted details of a single issue.
 * @param {object} issue - The issue object to display.
 */
export const displayFormattedIssueDetails = (issue) => {
  if (!issue) {
    console.log(formatWithEmoji('No issue data to display.', 'warning'));
    return;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(formatWithEmoji(`Details for Issue #${issue.id}`, 'issue'));
  console.log('─'.repeat(50));
  
  console.log(formatWithEmoji(`Subject: ${issue.subject}`, 'subject'));
  console.log(`${getStatusEmoji(issue.status?.name)} Status: ${issue.status?.name || 'Unknown'}`);
  console.log(`${getPriorityEmoji(issue.priority?.name)} Priority: ${issue.priority?.name || 'Unknown'}`);
  
  if (issue.project) {
    console.log(formatWithEmoji(`Project: ${issue.project.name}`, 'project'));
  }
  if (issue.author) {
    console.log(formatWithEmoji(`Author: ${issue.author.name}`, 'user'));
  }
  if (issue.assigned_to) {
    console.log(formatWithEmoji(`Assigned to: ${issue.assigned_to.name}`, 'user'));
  }
  if (issue.start_date) {
    console.log(formatWithEmoji(`Start date: ${issue.start_date}`, 'date'));
  }
  if (issue.due_date) {
    console.log(formatWithEmoji(`Due date: ${issue.due_date}`, 'date'));
  }
  if (issue.done_ratio !== undefined) {
    console.log(formatWithEmoji(`Progress: ${issue.done_ratio}%`, 'progress'));
  }
  console.log('─'.repeat(50));
  console.log('Description:');
  console.log(issue.description ? issue.description.replace(/<\/?[^>]+(>|$)/g, '') : 'No description available.');
  
  if (issue.custom_fields && issue.custom_fields.length > 0) {
    console.log('─'.repeat(50));
    console.log('Custom Fields:');
    issue.custom_fields.forEach(field => {
      if (field.value) {
        console.log(`${field.name}: ${field.value}`);
      }
    });
  }
  console.log('═'.repeat(50));
};
