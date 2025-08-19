import UnifiedAssistantChat from "./UnifiedAssistantChat";
import { LocalAssistantStrategy } from "./AssistantStrategy";

const AssistantChat = () => {
    return <UnifiedAssistantChat strategy={new LocalAssistantStrategy()} />;
};

export default AssistantChat;
