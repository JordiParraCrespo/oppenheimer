import { BotFacePicker } from '@oppenheimer/design-system-web';
import { useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BotProfileControl } from '@/features/bots/forms/bot-profile-form';

/**
 * The bot's face, a row of the Profile card under its colour: its hat, eyes
 * and mouth, each a row of faces in the draft's colour. Until its owner
 * picks, it wears the face its id picks; a pick, or going back to that face,
 * changes the card's draft, and the sidebar and the chat follow once it is
 * saved.
 */
export function BotAvatarFace({
  botId,
  control,
  pending,
}: {
  botId: string;
  control: BotProfileControl;
  /** A save is in flight: the pick waits for it. */
  pending: boolean;
}) {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'avatarFace' });
  const color = useWatch({ control, name: 'avatarColor' });

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-5 py-5">
      <span className="text-[14px] font-medium">{t('bots.settings.profile.face')}</span>
      <BotFacePicker
        value={field.value ?? null}
        onValueChange={field.onChange}
        disabled={pending}
        color={color}
        seed={botId}
        labels={{
          hat: t('bots.settings.profile.faceHat'),
          eyes: t('bots.settings.profile.faceEyes'),
          mouth: t('bots.settings.profile.faceMouth'),
          reset: t('bots.settings.profile.faceReset'),
        }}
        optionNames={{
          hat: {
            fedora: t('bots.settings.profile.faces.hat.fedora'),
            porkpie: t('bots.settings.profile.faces.hat.porkpie'),
            bowler: t('bots.settings.profile.faces.hat.bowler'),
            tophat: t('bots.settings.profile.faces.hat.tophat'),
            cap: t('bots.settings.profile.faces.hat.cap'),
            beanie: t('bots.settings.profile.faces.hat.beanie'),
          },
          eyes: {
            dots: t('bots.settings.profile.faces.eyes.dots'),
            happy: t('bots.settings.profile.faces.eyes.happy'),
            wink: t('bots.settings.profile.faces.eyes.wink'),
            big: t('bots.settings.profile.faces.eyes.big'),
          },
          mouth: {
            smile: t('bots.settings.profile.faces.mouth.smile'),
            grin: t('bots.settings.profile.faces.mouth.grin'),
            o: t('bots.settings.profile.faces.mouth.o'),
          },
        }}
      />
    </div>
  );
}
