import {
  Approval,
  ApprovalActions,
  ApprovalDescription,
  ApprovalDetail,
  ApprovalDetails,
  ApprovalHeader,
  ApprovalIcon,
  ApprovalOutcome,
  ApprovalTitle,
} from '@oppenheimer/design-system-mobile/approval';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ShieldAlert } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { ScrollView, View } from 'react-native';

export default function ApprovalScreen() {
  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Pending</Text>
        <Approval status="pending">
          <ApprovalHeader>
            <ApprovalIcon>
              <Icon as={ShieldAlert} size={16} />
            </ApprovalIcon>
            <View className="min-w-0 flex-1">
              <ApprovalTitle>Pause 3 domains</ApprovalTitle>
              <ApprovalDescription>domains_set_status</ApprovalDescription>
            </View>
          </ApprovalHeader>
          <ApprovalDetails>
            <ApprovalDetail label="Status">paused</ApprovalDetail>
            <ApprovalDetail label="Domains">acme.com, globex.io, initech.dev</ApprovalDetail>
          </ApprovalDetails>
          <ApprovalActions>
            <Button size="sm">
              <Text>Approve</Text>
            </Button>
            <Button size="sm" variant="outline">
              <Text>Reject</Text>
            </Button>
          </ApprovalActions>
        </Approval>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Resolved</Text>
        <Approval status="approved">
          <ApprovalHeader>
            <ApprovalIcon>
              <Icon as={ShieldAlert} size={16} />
            </ApprovalIcon>
            <View className="min-w-0 flex-1">
              <ApprovalTitle>Pause 3 domains</ApprovalTitle>
              <ApprovalDescription>domains_set_status</ApprovalDescription>
            </View>
          </ApprovalHeader>
          <ApprovalOutcome>Approved by you · 2 min ago</ApprovalOutcome>
        </Approval>
        <Approval status="rejected">
          <ApprovalHeader>
            <ApprovalIcon>
              <Icon as={ShieldAlert} size={16} />
            </ApprovalIcon>
            <View className="min-w-0 flex-1">
              <ApprovalTitle>Delete lead</ApprovalTitle>
              <ApprovalDescription>leads_delete</ApprovalDescription>
            </View>
          </ApprovalHeader>
          <ApprovalOutcome>Rejected</ApprovalOutcome>
        </Approval>
      </View>
    </ScrollView>
  );
}
