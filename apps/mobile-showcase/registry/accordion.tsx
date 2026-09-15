import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@oppenheimer/design-system-mobile/accordion';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function AccordionScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Single</Text>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>
              <Text className="text-base font-medium text-foreground">Is it accessible?</Text>
            </AccordionTrigger>
            <AccordionContent>
              <Text className="text-sm text-muted-foreground">
                Yes. It adheres to the WAI-ARIA design pattern.
              </Text>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>
              <Text className="text-base font-medium text-foreground">Is it styled?</Text>
            </AccordionTrigger>
            <AccordionContent>
              <Text className="text-sm text-muted-foreground">
                Yes. It comes with default styles from the design system.
              </Text>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>
              <Text className="text-base font-medium text-foreground">Is it animated?</Text>
            </AccordionTrigger>
            <AccordionContent>
              <Text className="text-sm text-muted-foreground">
                Yes. It uses Reanimated for smooth native animations.
              </Text>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Multiple</Text>
        <Accordion type="multiple">
          <AccordionItem value="a">
            <AccordionTrigger>
              <Text className="text-base font-medium text-foreground">First section</Text>
            </AccordionTrigger>
            <AccordionContent>
              <Text className="text-sm text-muted-foreground">
                Multiple items can be open at once.
              </Text>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>
              <Text className="text-base font-medium text-foreground">Second section</Text>
            </AccordionTrigger>
            <AccordionContent>
              <Text className="text-sm text-muted-foreground">
                Try opening both at the same time.
              </Text>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </View>
    </ScrollView>
  );
}
