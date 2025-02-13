<?php

namespace SilverStripe\AssetAdmin\Tests\Legacy\GraphQL;

use GraphQL\Type\Definition\ResolveInfo;
use SilverStripe\AssetAdmin\GraphQL\Notice;
use SilverStripe\AssetAdmin\GraphQL\UnpublishFileMutationCreator;
use SilverStripe\AssetAdmin\Tests\GraphQL\UnpublishFileMutationCreatorTest\FileOwner;
use SilverStripe\Assets\File;
use SilverStripe\Dev\SapphireTest;
use SilverStripe\GraphQL\Schema\Schema;
use SilverStripe\Security\Security;

class UnpublishFileMutationCreatorTest extends SapphireTest
{
    protected static $fixture_file = 'UnpublishFileMutationCreatorTest.yml';

    protected static $extra_dataobjects = [
        FileOwner::class,
    ];

    protected function setUp(): void
    {
        parent::setUp();
        if (class_exists(Schema::class)) {
            $this->markTestSkipped('GraphQL 3 test ' . __CLASS__ . ' skipped');
        }
        // Dynamically assign fileowner as owner (otherwise it pollutes other tests)
        FileOwner::config()->set('owns', ['OwnedFile']);
    }

    public function testUnpublishWithOwners()
    {
        // Bootstrap test
        $this->logInWithPermission('ADMIN');
        $member = Security::getCurrentUser();
        $mutation = new UnpublishFileMutationCreator();
        $context = ['currentUser' => $member];
        $resolveInfo = new ResolveInfo([]);

        /** @var File $file */
        $file = $this->objFromFixture(File::class, 'file1');
        $file->publishSingle();

        // 4 owners, 3 published owners
        for ($i = 1; $i <= 4; $i++) {
            $owner = new FileOwner();
            $owner->OwnedFileID = $file->ID;
            $owner->Title = "My Owner {$i}";
            $owner->write();
            // Only 3 of these are published
            if ($i !== 4) {
                $owner->publishSingle();
            }
        }

        // Test unpublish without force
        $result = $mutation->resolve(null, ['ids' => [$file->ID]], $context, $resolveInfo);
        $this->assertCount(1, $result);
        /** @var Notice $notice */
        $notice = $result[0];
        $this->assertInstanceOf(Notice::class, $notice);
        $this->assertEquals('File "The First File" is used in 3 places.', $notice->getMessage());
        $this->assertTrue($file->isPublished());

        // Unpublish with force
        $result = $mutation->resolve(null, ['ids' => [$file->ID], 'force' => true], $context, $resolveInfo);
        $this->assertCount(1, $result);
        $fileResult = $result[0];
        $this->assertInstanceOf(File::class, $fileResult);
        $this->assertFalse($file->isPublished());
    }
}
