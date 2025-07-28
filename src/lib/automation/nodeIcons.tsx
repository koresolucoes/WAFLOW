
import React from 'react';
import {
    SEND_ICON,
    PLUS_ICON,
    TRASH_ICON,
    FILE_TEXT_ICON,
    WEBHOOK_ICON,
    FUNNEL_ICON
} from '../../components/icons';

const TagIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>;
const MessageIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>;
const UserPlusIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>;
const ConditionIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.5 5.5 14h13z"/><path d="M12 3.5 5.5 10h13z"/></svg>;
const SplitIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3.5a2.5 2.5 0 0 1 3 5"/><path d="M8 3.5a2.5 2.5 0 0 0-3 5"/><path d="M12 12v10"/><path d="M12 2v4"/><path d="m4.5 8.5 4 4"/><path d="m15.5 12.5 4-4"/></svg>;
const CustomFieldIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M5 20h14"/><rect width="18" height="10" x="3" y="7" rx="2"/></svg>;
const MediaIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
const InteractiveIcon = ({className}: {className?: string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg>;


export const nodeIcons: Record<string, React.FC<{ className?: string }>> = {
    // Triggers
    'message_received_with_keyword': MessageIcon,
    'button_clicked': SEND_ICON,
    'new_contact': UserPlusIcon,
    'new_contact_with_tag': TagIcon,
    'webhook_received': WEBHOOK_ICON,
    'deal_created': FUNNEL_ICON,
    'deal_stage_changed': FUNNEL_ICON,
    // Actions
    'send_template': FILE_TEXT_ICON,
    'send_text_message': MessageIcon,
    'add_tag': TagIcon,
    'remove_tag': TRASH_ICON,
    'set_custom_field': CustomFieldIcon,
    'send_media': MediaIcon,
    'send_interactive_message': InteractiveIcon,
    'send_webhook': SEND_ICON,
    'create_deal': FUNNEL_ICON,
    'update_deal_stage': FUNNEL_ICON,
    // Logic
    'condition': ConditionIcon,
    'split_path': SplitIcon,
    // Default
    'default': FILE_TEXT_ICON,
};