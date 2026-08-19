---
title: GameplayTag와 GameplayCue
description: GameplayTag와 GameplayCue 아키텍처
author: gemini
date: 2025-09-10 19:00:00 +09:00
categories: [Unreal]
tags: [GameplayTag]
math: true
mermaid: true
---

#### GameplayTag의 본질

##### Bool 변수 지옥의 현실

- 전통적 방식의 문제점

```
class AMyCharacter
{
private:
    // 처음에는 간단해 보이지만...
    bool bIsBurning;
    bool bIsFrozen;
    bool bIsStunned;
    bool bIsSilenced;
    bool bIsPoisoned;
    bool bIsBlind;
    bool bIsSlowed;
    // ... 상태가 100개면 bool 100개?
};
```

1. 확장성 제로

```
void RemoveAllDebuffs()
{
    bIsBurning = false;
    bIsFrozen = false;
    bIsStunned = false;
    // 새로운 디버프 추가할 때마다 여기도 수정
}
```

2. 조건 검사의 복잡성

```
bool CanUseFireSpell()
{
    if (bIsFrozen) return false;
    if (bIsSilenced) return false;
    if (bIsStunned) return false;
    // 새로운 상태 추가할 때마다 여기도 수정
    return true;
}
```


##### Enum의 한계

```
enum class ECharacterState
{
    Normal,
    Burning,
    Frozen,
    Stunned,
    Poisoned
    // 하나의 상태만 가질 수 있음
};
```

*Enum은 단일 상태만 표현 가능하여 동시에 여러 상태를 가질 수 없다*


##### 태그 시스템의 핵심 개념

- GameplayTag는 **문자열 기반의 계층적 라벨 시스템**

```
Ability.Fire.Bolt         // 파이어볼트 능력
Status.Debuff.Frozen      // 얼음 디버프 상태
Cooldown.Ultimate         // 궁극기 쿨다운
GameplayCue.Explosion     // 폭발 연출 신호
```

```
Status                    // 최상위 (모든 상태의 부모)
├── Status.Buff          // 버프 (긍정적 효과)
├── Status.Debuff        // 디버프 (부정적 효과)
└── Status.Neutral       // 중립 (특수 상태)
```

- 핵심 특징
	1. **계층 구조** : 점으로 구분된 트리 형태
	2. **상속 검색** : 상위 태그로 하위 모든 태그 검색 가능
	3. **컨테이너 기반** : 여러 태그를 동시에 보유 가능

	```
	FGameplayTagContainer PlayerTags;  // 태그를 담는 컨테이너
	PlayerTags.AddTag("Status.Buff.Haste");       // 가속 버프
	PlayerTags.AddTag("Status.Debuff.Poisoned");  // 중독 디버프
	PlayerTags.AddTag("Cooldown.FireBolt");       // 파이어볼트 쿨다운
	```

	4. **에디터 통합** : 자동완성, 검증, 관리 도구 제공


##### 계층 구조 - 실제 예시로 이해하기

```
Status
├── Status.Buff
│   ├── Status.Buff.Temporary.Haste
│   └── Status.Buff.Permanent.Blessing
└── Status.Debuff
    ├── Status.Debuff.MovementImpaired
    │   ├── Status.Debuff.MovementImpaired.Slow
    │   └── Status.Debuff.MovementImpaired.Stun
    └── Status.Debuff.DamageOverTime
        ├── Status.Debuff.DamageOverTime.Poison
        └── Status.Debuff.DamageOverTime.Burning
```

- 가능한 검색들

```
// 모든 디버프 체크
if (ASC->HasMatchingGameplayTag("Status.Debuff"))
{
    // 새로운 디버프가 추가되어도 코드 수정 불필요
}

// 이동 방해 디버프만 체크
if (ASC->HasMatchingGameplayTag("Status.Debuff.MovementImpaired"))
{
    // 감속, 속박, 스턴 중 하나라도 있으면 실행
}

// 정확히 스턴만 체크
if (ASC->HasMatchingGameplayTag("Status.Debuff.MovementImpaired.Stun"))
{
    // 오직 스턴 상태일 때만
}
```

```
// 기존 방식 - 하드코딩 지옥
bool HasAnyDebuff()
{
    return bIsBurning || bIsFrozen || bIsStunned || bIsPoisoned ||
           bIsSlowed || bIsRooted || bIsSilenced || bIsBlind ||
           bIsWeakened || bIsCursed || bIsHexed || /* ... */;
    // 디버프 100개면 100개 다 나열
    // 새로운 디버프 추가할 때마다 수정
    // 하나라도 빼먹으면 버그 ㅅㄱ
}
```


##### 태그 매칭의 종류 - 세밀한 제어

1. Exact Match (정확 일치)

```
HasMatchingGameplayTag("Status.Debuff.Frozen")
```

2. Partial Match (부분 일치)

```
HasMatchingGameplayTag("Status.Debuff")
// Status.Debuff로 시작하는 모든 태그 매치
```

3. Container Match (컨테이너 일치)

```
FGameplayTagContainer RequiredTags;
RequiredTags.AddTag("Status.Buff.Haste");
RequiredTags.AddTag("Status.Buff.Shield");

if (ASC->HasAnyMatchingGameplayTags(RequiredTags))
{
    // 하나라도 있으면
}

if (ASC->HasAllMatchingGameplayTags(RequiredTags))
{
    // 모두 있어야 함
}
```


##### 태그 저장과 검색 매커니즘

- 내부 구조

```
struct FGameplayTag
{
    FName TagName;  // 해시 기반 빠른 비교
};

struct FGameplayTagContainer
{
    TArray<FGameplayTag> GameplayTags;
    TArray<FGameplayTag> ParentTags;  // 미리 계산된 부모 태그들
};

ParentTags.Add("Status");
ParentTags.Add("Status.Debuff");
ParentTags.Add("Status.Debuff.Frozen");
```

- 최적화 포인트
	- FName 기반 O(1) 비교 속도
	- 부모 태그 미리 계산하여 캐시
	- 네트워크에서 인덱스로 전송


##### 태그와 Ability System의 통합

```
class UMyAbility : public UGameplayAbility
{
    // 이 Ability가 가진 태그들
    FGameplayTagContainer AbilityTags;

    // 이 태그들이 있으면 실행 불가
    FGameplayTagContainer BlockAbilitiesWithTag;

    // 이 태그들이 모두 있어야 실행 가능
    FGameplayTagContainer ActivationRequiredTags;

    // 실행 중에 추가되는 태그들
    FGameplayTagContainer ActivationOwnedTags;
};
```

- 파이어볼트 스킬 설정 예시

```
UFireBoltAbility::UFireBoltAbility()
{
    AbilityTags.AddTag("Ability.Fire.Bolt");
    AbilityTags.AddTag("Ability.Offensive");

    BlockAbilitiesWithTag.AddTag("Status.Debuff.Silenced");
    BlockAbilitiesWithTag.AddTag("Status.Debuff.Frozen");

    ActivationOwnedTags.AddTag("Status.Casting");
    ActivationOwnedTags.AddTag("Cooldown.FireBolt");
}
```


##### 명명 규칙과 체계화 - 팀 작업의 핵심

- 추천구조

```
Ability
├── Ability.Active.Fire.Bolt
├── Ability.Passive.FireResist
└── Ability.Ultimate.Meteor

Status
├── Status.Buff.Temporary
├── Status.Debuff.MovementImpaired
└── Status.Neutral.InCombat

Cooldown
├── Cooldown.Ability.Fire
└── Cooldown.Item.Potion

GameplayCue
├── GameplayCue.Impact
├── GameplayCue.Status
└── GameplayCue.Environment

Damage
├── Damage.Physical.Slash
├── Damage.Magical.Fire
└── Damage.True.Percentage
```

- 명명 규칙 가이드라인
	1. 상위 -> 하위로 갈수록 구체적으로
	2. 동일 계층은 동일한 패턴
	3. 미래 추가 요소 고려한 구조
	4. 영어 단수형, PascalCase 사용


##### 태그 관리 전략 - 프로젝트 관리 관점

- 중앙 집중식 관리

```
; Config/DefaultGameplayTags.ini
[/Script/GameplayTags.GameplayTagsSettings]

+GameplayTagList=(Tag="Status.Burning",DevComment="불타는 상태 - 지속 피해")
+GameplayTagList=(Tag="Status.Frozen",DevComment="얼어붙은 상태 - 이동/행동 불가")
+GameplayTagList=(Tag="Ability.Fire.Bolt",DevComment="파이어볼트 - 기본 화염 스킬")
```

- 버전 관리와 호환성

```
+GameplayTagRedirects=(OldTagName="OldStatus.Burn",NewTagName="Status.Debuff.Burning")
```


#### GameplayCue의 본질과 생명주기

##### 전통적 연출 시스템의 한계

- 전통적 방식

```
void CastFireball()
{
    // 게임플레이 로직
    DealDamage(Target, 100);
    ReduceMana(Player, 50);
    StartCooldown(5.0f);

    // 연출 처리 (하드코딩)
    UGameplayStatics::PlaySoundAtLocation(GetWorld(), FireballSound, GetActorLocation());
    UGameplayStatics::SpawnEmitterAtLocation(GetWorld(), FireballEffect, HitLocation);
    GetWorld()->GetFirstPlayerController()->ClientPlayCameraShake(MediumShake);
    ShowDamageNumber(100, HitLocation);
    UpdateHealthBar(Target);
}
```

- 문제점
	1. 로직과 연출의 결합
	2. 중복 코드 양산
	3. 네트워크 동기화 문제
	4. 유지보수 지옥
	5. 조건부 연출의 복잡성


##### GameplayCue의 혁신적 접근

- **"게임 플레이 로직과 연출을 완전히 분리하고, 태그로 연결하자!"**

```
// GAS 방식
void CastFireball()
{
    // 게임플레이 로직만
    FGameplayEffectContextHandle Context = ASC->MakeEffectContext();
    Context.AddHitResult(HitResult);
    Context.AddSourceObject(this);

    ASC->ApplyGameplayEffectToTarget(FireballDamageEffect, Target, 1.0f, Context);

    // 연출은 태그로 신호만
    FGameplayCueParameters CueParams;
    CueParams.Location = HitResult.Location;
    CueParams.Normal = HitResult.Normal;
    CueParams.RawMagnitude = CalculatedDamage;

    ASC->ExecuteGameplayCue("GameplayCue.Spell.Fireball.Impact", CueParams);
}
```

- 연출 처리 분리

```
class AGameplayCue_Spell_Fireball_Impact : public AGameplayCueNotify_Actor
{
public:
    virtual void OnExecute(AActor* Target, const FGameplayCueParameters& Parameters) override
    {
        PlaySound(FireballImpactSound, Parameters.Location);
        SpawnParticle(FireballExplosion, Parameters.Location, Parameters.Normal);
        ShakeCamera(Parameters.RawMagnitude);
        ShowDamageNumber(Parameters.RawMagnitude, Parameters.Location);
    }
};
```


##### Cue의 세 가지 타입

1. Execute Cue (실행형) - 한 방

	```
	ASC->ExecuteGameplayCue("GameplayCue.Explosion.Fireball");
	```

	- 즉시 실행 후 자동 정리
	- 폭발, 타격, 힐링 이펙트

2. Add Cue (추가형) - 지속 시작

	```
	ASC->AddGameplayCue("GameplayCue.Status.Burning");
	```

	- 수동 제거까지 지속
	- 버프/디버프 상태 표시

3. Remove Cue (제거형) - 지속 종료

	```
	ASC->RemoveGameplayCue("GameplayCue.Status.Burning");
	```

	- Add된 Cue 정리
	- 종료 연출 추가 가능


##### GameplayCue의 생명주기

- Execute Cue 생명주기

```
ExecuteGameplayCue 호출 → Cue 클래스 찾기 → OnExecute 실행 → 자동 정리
```

-  Add/Remove Cue 생명주기

```
AddGameplayCue → 인스턴스 생성 → OnActive 실행 → WhileActive 반복
→ RemoveGameplayCue → OnRemove 실행 → 정리
```


##### 생명주기 함수들의 역할

- OnExecute - 한 방 효과

```
virtual void OnExecute(AActor* Target, const FGameplayCueParameters& Parameters) override
{
    // 파티클 이펙트
    UGameplayStatics::SpawnEmitterAtLocation(
        GetWorld(),
        ExplosionParticle,
        Parameters.Location,
        FRotator::ZeroRotator,
        FVector(Parameters.RawMagnitude / 100.0f)
    );

    // 사운드
    UGameplayStatics::PlaySoundAtLocation(
        GetWorld(),
        ExplosionSound,
        Parameters.Location
    );

    // 카메라 흔들림
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        float ShakeIntensity = Parameters.RawMagnitude / 100.0f;
        PC->ClientPlayCameraShake(GetShakeClassForIntensity(ShakeIntensity));
    }
}
```

- OnActive - 지속 효과 시작

```
virtual void OnActive(AActor* Target, const FGameplayCueParameters& Parameters) override
{
    // 파티클 시스템 시작
    if (USkeletalMeshComponent* Mesh = Target->FindComponentByClass<USkeletalMeshComponent>())
    {
        BurningParticleComponent = UGameplayStatics::SpawnEmitterAttached(
            BurningParticleSystem,
            Mesh,
            NAME_None,
            FVector::ZeroVector,
            FRotator::ZeroRotator,
            EAttachLocation::KeepWorldPosition
        );
    }

    // 루프 사운드 재생
    BurningAudioComponent = UGameplayStatics::SpawnSoundAttached(
        BurningLoopSound,
        Target->GetRootComponent()
    );

    // 머티리얼 변경
    // UI 아이콘 표시
}
```

- WhileActive - 진행 중 처리

```
virtual bool WhileActive(AActor* Target, const FGameplayCueParameters& Parameters) override
{
    // 동적 효과 조절
    if (BurningParticleComponent)
    {
        if (UWeatherSystem* Weather = GetWorld()->GetSubsystem<UWeatherSystem>())
        {
            if (Weather->IsRaining())
            {
                float RainIntensity = Weather->GetRainIntensity();
                float ReductionFactor = 1.0f - (RainIntensity * 0.5f);
                BurningParticleComponent->SetFloatParameter("Intensity", ReductionFactor);
            }
        }
    }

    return true;  // 계속 진행
}
```

- OnRemove - 지속 효과 종료

```
virtual void OnRemove(AActor* Target, const FGameplayCueParameters& Parameters) override
{
    // 파티클 시스템 정지
    if (BurningParticleComponent)
    {
        BurningParticleComponent->SetAutoDestroy(true);
        BurningParticleComponent->Deactivate();
        BurningParticleComponent = nullptr;
    }

    // 사운드 페이드아웃
    if (BurningAudioComponent)
    {
        BurningAudioComponent->FadeOut(1.0f, 0.0f);
        BurningAudioComponent = nullptr;
    }

    // 머티리얼 원복
    // UI 아이콘 제거
    // 종료 연출
}
```


##### Parameters를 통한 데이터 전달 - 동적 연출

```
FGameplayCueParameters CueParams;

// 기본 정보
CueParams.RawMagnitude = DamageAmount;
CueParams.Location = HitLocation;
CueParams.Normal = SurfaceNormal;
CueParams.PhysicalMaterial = HitMaterial;

// 게임플레이 정보
CueParams.GameplayEffectLevel = Level;
CueParams.AbilityLevel = AbilityLevel;
CueParams.EffectCauser = CastingActor;
CueParams.SourceObject = WeaponObject;

ASC->ExecuteGameplayCue("GameplayCue.Impact.Weapon", CueParams);
```

- 연출에서 활용

```
void OnExecute(AActor* Target, const FGameplayCueParameters& Parameters) override
{
    // 데미지 크기에 따른 이펙트 조절
    float EffectScale = FMath::Clamp(Parameters.RawMagnitude / 100.0f, 0.5f, 3.0f);

    // 표면 재질에 따른 사운드 선택
    if (Parameters.PhysicalMaterial)
    {
        USoundBase* HitSound = GetSoundForMaterial(Parameters.PhysicalMaterial);
    }

    // 스킬 레벨에 따른 색상 변화
    FLinearColor EffectColor = FMath::Lerp(
        FLinearColor::White,
        FLinearColor::Gold,
        Parameters.AbilityLevel / 10.0f
    );
}
```


##### Local vs Replicated Cue

- Local Cue (로컬 전용)

	```
	ASC->ExecuteGameplayCueLocal("GameplayCue.UI.ExperienceGain");
	ASC->ExecuteGameplayCueLocal("GameplayCue.Camera.Zoom");
	```

	- UI 피드백
	- 카메라 효과
	- 개인 설정 효과

- Replicated Cue (네트워크 복제)

	```
	ASC->ExecuteGameplayCue("GameplayCue.Spell.Fireball.Cast");
	ASC->AddGameplayCue("GameplayCue.Status.Burning");
	```

	- 캐릭터 상태 표시
	- 스킬 연출
	- 환경 변화


##### GameplayCue 클래스 계층

- GameplayCueNotify_Static(가벼운 연출)

	```
	class UMyGameplayCue_Simple : public UGameplayCueNotify_Static
	{
	public:
	    virtual void OnExecute_Implementation(
	        AActor* Target,
	        const FGameplayCueParameters& Parameters,
	        const FGameplayEffectContextHandle& EffectContext
	    ) override
	    {
	        UGameplayStatics::SpawnEmitterAtLocation(GetWorld(), SimpleParticle, Parameters.Location);
	        UGameplayStatics::PlaySoundAtLocation(GetWorld(), SimpleSound, Parameters.Location);
	    }
	};
	```

	- 메모리 효율적
	- 간단한 로직만

- GameplayCueNotify_Actor (복잡한 연출)

	```
	class AMyGameplayCue_Complex : public AGameplayCueNotify_Actor
	{
	public:
	    virtual void OnActive(AActor* Target, const FGameplayCueParameters& Parameters) override;
	    virtual bool WhileActive(AActor* Target, const FGameplayCueParameters& Parameters) override;
	    virtual void OnRemove(AActor* Target, const FGameplayCueParameters& Parameters) override;

	private:
	    UPROPERTY()
	    UParticleSystemComponent* ComplexParticle;

	    UPROPERTY()
	    UAudioComponent* LoopingAudio;
	};
	```

	- 복잡한 처리 가능
	- 상태 유지 가능


#### Tag와 Cue의 통합 활용 - 독 스택 시스템 구현

- PoisonEffect.h

```
#pragma once
#include "CoreMinimal.h"
#include "GameplayEffect.h"
#include "PoisonEffect.generated.h"

UCLASS()
class UPoisonEffect : public UGameplayEffect
{
    GENERATED_BODY()
public:
    UPoisonEffect();
};
```

- PoisonEffect.cpp

```
#include "PoisonEffect.h"

UPoisonEffect::UPoisonEffect()
{
    // 기본 설정
    DurationPolicy = EGameplayEffectDurationType::HasDuration;
    DurationMagnitude.SetValue(20.0f);
    Period = 4.0f;
    bExecutePeriodicEffectOnApplication = true;

    // 데미지 설정
    FGameplayModifierInfo DamageModifier;
    DamageModifier.ModifierMagnitude.SetValue(-15.0f);
    DamageModifier.ModifierOp = EGameplayModOp::Additive;
    DamageModifier.Attribute = UMyAttributeSet::GetHealthAttribute();
    Modifiers.Add(DamageModifier);

    // 태그 부여
    InheritableOwnedGameplayTags.AddTag(FGameplayTag::RequestGameplayTag("Status.Poisoned"));
    InheritableOwnedGameplayTags.AddTag(FGameplayTag::RequestGameplayTag("Status.Debuff"));
    InheritableOwnedGameplayTags.AddTag(FGameplayTag::RequestGameplayTag("Status.DamageOverTime"));

    // 스택 시스템
    StackingType = EGameplayEffectStackingType::AggregateByTarget;
    StackLimitCount = 5;
    StackDurationRefreshPolicy = EGameplayEffectStackingDurationPolicy::RefreshOnSuccessfulApplication;
    StackPeriodResetPolicy = EGameplayEffectStackingPeriodResetPolicy::ResetOnSuccessfulApplication;
    StackExpirationPolicy = EGameplayEffectStackingExpirationPolicy::ClearEntireStack;

    // GameplayCue 연결
    FGameplayCueTag PoisonCue;
    PoisonCue.GameplayCueTag = FGameplayTag::RequestGameplayTag("GameplayCue.Status.Poisoned");
    GameplayCues.Add(PoisonCue);
}
```

- GameplayCue_Status_Poisoned.h

```
#pragma once
#include "CoreMinimal.h"
#include "GameplayCueNotify_Actor.h"
#include "GameplayCue_Status_Poisoned.generated.h"

UCLASS()
class AGameplayCue_Status_Poisoned : public AGameplayCueNotify_Actor
{
    GENERATED_BODY()

public:
    virtual void OnActive(AActor* Target, const FGameplayCueParameters& Parameters) override;
    virtual void OnRemove(AActor* Target, const FGameplayCueParameters& Parameters) override;

    void OnStackChanged(AActor* Target, int32 NewStackCount, int32 OldStackCount);

protected:
    // 파티클 시스템
    UPROPERTY(EditDefaultsOnly, Category = "Effects")
    UParticleSystem* PoisonParticleSystem;

    UPROPERTY(EditDefaultsOnly, Category = "Effects")
    UParticleSystem* PoisonAuraParticleSystem;

    UPROPERTY(EditDefaultsOnly, Category = "Effects")
    UParticleSystem* PoisonStackIncreaseEffect;

    // 사운드
    UPROPERTY(EditDefaultsOnly, Category = "Sounds")
    USoundBase* LightPoisonSound;

    UPROPERTY(EditDefaultsOnly, Category = "Sounds")
    USoundBase* ModeratePoisonSound;

    UPROPERTY(EditDefaultsOnly, Category = "Sounds")
    USoundBase* HeavyPoisonSound;

    UPROPERTY(EditDefaultsOnly, Category = "Sounds")
    USoundBase* LethalPoisonSound;

    UPROPERTY(EditDefaultsOnly, Category = "Sounds")
    USoundBase* PoisonStackIncreaseSound;

    // 머티리얼
    UPROPERTY(EditDefaultsOnly, Category = "Materials")
    UMaterialInterface* PoisonMaterial;

private:
    UPROPERTY()
    UParticleSystemComponent* PoisonParticleComponent;

    UPROPERTY()
    UParticleSystemComponent* AuraParticleComponent;

    UPROPERTY()
    UAudioComponent* PoisonAudioComponent;

    TArray<UMaterialInterface*> OriginalMaterials;

    void OnStackIncreased(AActor* Target, int32 NewStackCount, int32 OldStackCount);
    void OnStackDecreased(AActor* Target, int32 NewStackCount, int32 OldStackCount);
    void PlayStackMilestoneEffect(AActor* Target, int32 Milestone);
};
```

- GameplayCue_Status_Poisoned.cpp

```
#include "GameplayCue_Status_Poisoned.h"
#include "AbilitySystemComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Kismet/GameplayStatics.h"

void AGameplayCue_Status_Poisoned::OnActive(AActor* Target, const FGameplayCueParameters& Parameters)
{
    int32 StackCount = FMath::Max(1, Parameters.GameplayEffectLevel);

    // 파티클 생성 및 강도 조절
    if (USkeletalMeshComponent* Mesh = Target->FindComponentByClass<USkeletalMeshComponent>())
    {
        PoisonParticleComponent = UGameplayStatics::SpawnEmitterAttached(
            PoisonParticleSystem,
            Mesh,
            NAME_None,
            FVector::ZeroVector,
            FRotator::ZeroRotator,
            EAttachLocation::KeepWorldPosition
        );

        if (PoisonParticleComponent)
        {
            float Intensity = FMath::Clamp(StackCount / 5.0f, 0.2f, 1.0f);
            PoisonParticleComponent->SetFloatParameter("Intensity", Intensity);

            FLinearColor PoisonColor = FMath::Lerp(
                FLinearColor::Green,
                FLinearColor(0.5f, 0.0f, 1.0f, 1.0f),
                (StackCount - 1) / 4.0f
            );
            PoisonParticleComponent->SetColorParameter("PoisonColor", PoisonColor);
        }
    }

    // 스택별 사운드
    USoundBase* PoisonSound = nullptr;
    float SoundVolume = 1.0f;

    switch (StackCount)
    {
    case 1:
        PoisonSound = LightPoisonSound;
        SoundVolume = 0.3f;
        break;
    case 2:
        PoisonSound = ModeratePoisonSound;
        SoundVolume = 0.5f;
        break;
    case 3:
    case 4:
        PoisonSound = HeavyPoisonSound;
        SoundVolume = 0.8f;
        break;
    default:
        PoisonSound = LethalPoisonSound;
        SoundVolume = 1.0f;
        break;
    }

    if (PoisonSound)
    {
        PoisonAudioComponent = UGameplayStatics::SpawnSoundAttached(
            PoisonSound,
            Target->GetRootComponent()
        );

        if (PoisonAudioComponent)
        {
            PoisonAudioComponent->SetVolumeMultiplier(SoundVolume);
        }
    }

    // 머티리얼 변경
    if (USkeletalMeshComponent* Mesh = Target->FindComponentByClass<USkeletalMeshComponent>())
    {
        OriginalMaterials.Empty();
        for (int32 i = 0; i < Mesh->GetNumMaterials(); ++i)
        {
            OriginalMaterials.Add(Mesh->GetMaterial(i));

            if (PoisonMaterial)
            {
                UMaterialInstanceDynamic* DynamicMat =
                    UMaterialInstanceDynamic::Create(PoisonMaterial, this);

                float PoisonIntensity = FMath::Clamp(StackCount / 5.0f, 0.1f, 1.0f);
                DynamicMat->SetScalarParameterValue("PoisonIntensity", PoisonIntensity);
                DynamicMat->SetScalarParameterValue("SkinDiscoloration", PoisonIntensity * 0.8f);

                Mesh->SetMaterial(i, DynamicMat);
            }
        }
    }

    // 3스택 이상 특별 효과
    if (StackCount >= 3)
    {
        if (UAbilitySystemComponent* ASC =
            Target->FindComponentByClass<UAbilitySystemComponent>())
        {
            ASC->ExecuteGameplayCue("GameplayCue.Warning.HighPoison");
        }

        if (USkeletalMeshComponent* Mesh = Target->FindComponentByClass<USkeletalMeshComponent>())
        {
            AuraParticleComponent = UGameplayStatics::SpawnEmitterAttached(
                PoisonAuraParticleSystem,
                Mesh
            );
        }
    }

    // 5스택 즉사 경고
    if (StackCount >= 5)
    {
        if (PoisonParticleComponent)
        {
            PoisonParticleComponent->SetFloatParameter("Intensity", 2.0f);
        }

        if (PoisonAudioComponent)
        {
            PoisonAudioComponent->SetVolumeMultiplier(1.5f);
        }

        if (UAbilitySystemComponent* ASC =
            Target->FindComponentByClass<UAbilitySystemComponent>())
        {
            ASC->ExecuteGameplayCue("GameplayCue.Warning.ImminentDeath");
        }
    }
}

void AGameplayCue_Status_Poisoned::OnRemove(AActor* Target, const FGameplayCueParameters& Parameters)
{
    // 파티클 정리
    if (PoisonParticleComponent)
    {
        PoisonParticleComponent->SetAutoDestroy(true);
        PoisonParticleComponent->Deactivate();
        PoisonParticleComponent = nullptr;
    }

    if (AuraParticleComponent)
    {
        AuraParticleComponent->SetAutoDestroy(true);
        AuraParticleComponent->Deactivate();
        AuraParticleComponent = nullptr;
    }

    // 사운드 페이드아웃
    if (PoisonAudioComponent)
    {
        PoisonAudioComponent->FadeOut(1.0f, 0.0f);
        PoisonAudioComponent = nullptr;
    }

    // 머티리얼 원복
    if (USkeletalMeshComponent* Mesh = Target->FindComponentByClass<USkeletalMeshComponent>())
    {
        for (int32 i = 0; i < OriginalMaterials.Num() && i < Mesh->GetNumMaterials(); ++i)
        {
            Mesh->SetMaterial(i, OriginalMaterials[i]);
        }
        
        OriginalMaterials.Empty();
    }
}

void AGameplayCue_Status_Poisoned::OnStackIncreased(AActor* Target, int32 NewStackCount, int32 OldStackCount)
{
    // 스택 증가 효과
    UGameplayStatics::SpawnEmitterAtLocation(
        GetWorld(),
        PoisonStackIncreaseEffect,
        Target->GetActorLocation()
    );

    UGameplayStatics::PlaySoundAtLocation(
        GetWorld(),
        PoisonStackIncreaseSound,
        Target->GetActorLocation()
    );

    // 파티클 강도 업데이트
    if (PoisonParticleComponent)
    {
        float NewIntensity = FMath::Clamp(NewStackCount / 5.0f, 0.2f, 2.0f);
        PoisonParticleComponent->SetFloatParameter("Intensity", NewIntensity);
    }

    // 마일스톤 체크
    if (NewStackCount >= 3 && OldStackCount < 3)
    {
        PlayStackMilestoneEffect(Target, 3);
    }

    if (NewStackCount >= 5)
    {
        PlayStackMilestoneEffect(Target, 5);
    }
}

void AGameplayCue_Status_Poisoned::PlayStackMilestoneEffect(AActor* Target, int32 Milestone)
{
    FString MilestoneTag = FString::Printf(TEXT("GameplayCue.Poison.Stack%d"), Milestone);

    if (UAbilitySystemComponent* ASC =
        Target->FindComponentByClass<UAbilitySystemComponent>())
    {
        ASC->ExecuteGameplayCue(FGameplayTag::RequestGameplayTag(*MilestoneTag));
    }
}
```


#### 상태 표시 UI 시스템 구현

- StatusIconWidget.h

```
#pragma once
#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "StatusIconWidget.generated.h"

USTRUCT(BlueprintType)
struct FStatusIconData
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly)
    UTexture2D* IconTexture;

    UPROPERTY(EditDefaultsOnly)
    FLinearColor IconColor = FLinearColor::White;

    UPROPERTY(EditDefaultsOnly)
    bool bShowStack = false;

    UPROPERTY(EditDefaultsOnly)
    bool bShowTimer = false;
};

UCLASS()
class UStatusIconWidget : public UUserWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    class UImage* IconImage;

    UPROPERTY(meta = (BindWidget))
    class UTextBlock* StackText;

    UPROPERTY(meta = (BindWidget))
    class UTextBlock* TimerText;

    UPROPERTY(meta = (BindWidget))
    class UProgressBar* TimerBar;

    UPROPERTY(meta = (BindWidget))
    class UBorder* IconBorder;

public:
    void SetIconData(const FStatusIconData& IconData);
    void UpdateStackCount(int32 StackCount);
    void UpdateTimer(float RemainingTime, float MaxDuration);
    void SetDangerLevel(float DangerLevel);

    void PlayPulseAnimation();
    void PlayWarningAnimation();
    void PlayFadeInAnimation();
    void PlayFadeOutAnimation();

private:
    FStatusIconData CurrentIconData;
    float CurrentMaxDuration = 0.0f;
};
```

- StatusIconWidget.cpp

```
#include "StatusIconWidget.h"
#include "Components/Image.h"
#include "Components/TextBlock.h"
#include "Components/ProgressBar.h"
#include "Components/Border.h"

void UStatusIconWidget::SetIconData(const FStatusIconData& IconData)
{
    CurrentIconData = IconData;

    if (IconImage && IconData.IconTexture)
    {
        IconImage->SetBrushFromTexture(IconData.IconTexture);
        IconImage->SetColorAndOpacity(IconData.IconColor);
    }

    if (StackText)
    {
        StackText->SetVisibility(IconData.bShowStack ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
    }

    if (TimerText && TimerBar)
    {
        ESlateVisibility TimerVisibility = IconData.bShowTimer ? ESlateVisibility::Visible : ESlateVisibility::Collapsed;
        TimerText->SetVisibility(TimerVisibility);
        TimerBar->SetVisibility(TimerVisibility);
    }
}

void UStatusIconWidget::UpdateStackCount(int32 StackCount)
{
    if (StackText && CurrentIconData.bShowStack)
    {
        StackText->SetText(FText::AsNumber(StackCount));

        // 스택에 따른 색상 변화
        FLinearColor TextColor = FLinearColor::White;
        if (StackCount >= 5)
        {
            TextColor = FLinearColor::Red;
        }
        else if (StackCount >= 3)
        {
            TextColor = FLinearColor(1.0f, 0.5f, 0.0f);  // Orange
        }
        else if (StackCount >= 2)
        {
            TextColor = FLinearColor::Yellow;
        }

        StackText->SetColorAndOpacity(FSlateColor(TextColor));
    }
}

void UStatusIconWidget::UpdateTimer(float RemainingTime, float MaxDuration)
{
    if (!CurrentIconData.bShowTimer) return;

    CurrentMaxDuration = MaxDuration;

    if (TimerBar)
    {
        float Progress = MaxDuration > 0 ? RemainingTime / MaxDuration : 0.0f;
        TimerBar->SetPercent(Progress);
    }

    if (TimerText)
    {
        int32 Seconds = FMath::CeilToInt(RemainingTime);
        FString TimerString;

        if (Seconds >= 60)
        {
            int32 Minutes = Seconds / 60;
            Seconds = Seconds % 60;
            TimerString = FString::Printf(TEXT("%d:%02d"), Minutes, Seconds);
        }
        else
        {
            TimerString = FString::Printf(TEXT("%d"), Seconds);
        }

        TimerText->SetText(FText::FromString(TimerString));
    }
}

void UStatusIconWidget::SetDangerLevel(float DangerLevel)
{
    if (IconBorder)
    {
        FLinearColor BorderColor = FMath::Lerp(
            FLinearColor::Green,
            FLinearColor::Red,
            DangerLevel
        );

        IconBorder->SetBrushColor(BorderColor);
    }
}

void UStatusIconWidget::PlayPulseAnimation()
{
    // Blueprint에서 애니메이션 구현
    PlayAnimation(GetAnimationByName("PulseAnim"));
}

void UStatusIconWidget::PlayWarningAnimation()
{
    // Blueprint에서 애니메이션 구현
    PlayAnimation(GetAnimationByName("WarningAnim"));
}
```